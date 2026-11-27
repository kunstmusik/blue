#include "ConfinedRender.h"

#include "CsoundLoader.h"
#include "CsoundRuntimeServices.h"

#include <cerrno>
#include <cinttypes>
#include <cstdio>
#include <fcntl.h>
#include <cstring>
#include <string>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#include <sddl.h>
#include <winternl.h>
#include <io.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#ifdef __APPLE__
#include <sys/acl.h>
#include <sys/attr.h>
#include <sys/clonefile.h>
#include <sys/xattr.h>
#endif
#endif

namespace blue {
namespace {

constexpr size_t kMaxCsdBytes = 4 * 1024 * 1024;
constexpr int kExitRootMismatch = 70;
constexpr int kExitTargetExists = 71;
constexpr int kExitUnsupportedFs = 72;
constexpr int kExitPublishFailed = 73;
constexpr int kExitDirNotEmpty = 74;

bool isValidLeafWavName(const std::string &name) {
  if (name.empty() || name.size() > 255) return false;
  if (name == "." || name == "..") return false;
  for (const unsigned char ch : name) {
    if (ch < 0x20 || ch == 0x7f) return false;
    if (ch == '/' || ch == '\\' || ch == ':') return false;
  }
  if (name.back() == '.') return false;
  if (name.size() <= 4) return false;
  const std::string ext = name.substr(name.size() - 4);
  return (ext[0] == '.') && (ext[1] == 'w' || ext[1] == 'W') &&
         (ext[2] == 'a' || ext[2] == 'A') && (ext[3] == 'v' || ext[3] == 'V');
}

bool isManagedOutputOption(const std::string &option) {
  return option == "-o" || option.rfind("-o", 0) == 0 ||
         option == "--output" || option.rfind("--output=", 0) == 0;
}

int runStagedCsound(const std::string &csdText,
                    const std::string &csoundLibraryPath,
                    const std::vector<std::string> &csoundArguments) {
  CsoundLoader::unload();
  if (!CsoundLoader::load(csoundLibraryPath) || !CsoundLoader::initialize()) {
    std::fprintf(stderr, "%s\n", CsoundLoader::getError().c_str());
    CsoundLoader::unload();
    return 2;
  }

  csound::CSOUND *csound = CsoundLoader::csoundCreate(nullptr, nullptr);
  if (!csound) {
    std::fprintf(stderr, "Failed to create Csound instance\n");
    CsoundLoader::unload();
    return 70;
  }

  CsoundLoader::csoundCreateMessageBuffer(csound, 0);
  const auto onMessage = [](const std::string &message) {
    std::fwrite(message.data(), 1, message.size(), stderr);
    std::fflush(stderr);
  };

  int result = csound::CSOUND_ERROR;
  if (CsoundLoader::csoundCompileCSD && csdText.find('\0') == std::string::npos) {
    result = 0;
    for (const auto &option : csoundArguments) {
      if (isManagedOutputOption(option)) {
        std::fprintf(stderr,
                     "CONFINED_INVALID_ARGUMENT: Output flag is managed by confined render\n");
        result = csound::CSOUND_ERROR;
        break;
      }
      result = CsoundLoader::csoundSetOption(csound, option.c_str());
      if (result != 0) break;
    }
    if (result == 0) {
      result = CsoundLoader::csoundSetOption(csound, "-o stdout");
    }
    if (result == 0) {
      result = CsoundLoader::csoundCompileCSD(csound, csdText.c_str(), 1, 0);
      result = CsoundRuntimeServices::performCompiled(csound, result, onMessage);
    }
  } else {
    std::fprintf(stderr, "Confined render requires an in-memory CSD and csoundCompileCSD\n");
  }
  CsoundLoader::csoundReset(csound);
  CsoundLoader::csoundDestroyMessageBuffer(csound);
  CsoundLoader::csoundDestroy(csound);
  CsoundLoader::unload();
  return result;
}

bool readCsdFromStdin(std::string &outText, std::string &error) {
  outText.clear();
  char buffer[8192];
  while (true) {
    const size_t n = std::fread(buffer, 1, sizeof(buffer), stdin);
    if (n > 0) {
      if (outText.size() + n > kMaxCsdBytes) {
        error = "CONFINED_INPUT_TOO_LARGE: CSD payload exceeds limit";
        return false;
      }
      outText.append(buffer, n);
    }
    if (n < sizeof(buffer)) {
      if (std::ferror(stdin)) {
        error = "CONFINED_INPUT_ERROR: Failed reading CSD from stdin";
        return false;
      }
      break;
    }
  }
  if (outText.empty()) {
    error = "CONFINED_INPUT_EMPTY: CSD payload on stdin is empty";
    return false;
  }
  return true;
}

#ifndef _WIN32

struct PosixDirectories {
  int rootFd = -1;
  int stagingFd = -1;

  ~PosixDirectories() {
    if (stagingFd >= 0) close(stagingFd);
    if (rootFd >= 0) close(rootFd);
  }
};

constexpr int kDirectoryFlags = O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC;

bool isPosixDirectory(int fd, uint64_t dev, uint64_t ino) {
  struct stat info {};
  return fd >= 0 && fstat(fd, &info) == 0 && S_ISDIR(info.st_mode) &&
         static_cast<uint64_t>(info.st_dev) == dev &&
         static_cast<uint64_t>(info.st_ino) == ino;
}

#ifdef __APPLE__
constexpr nlink_t kScratchLinks = 1;
#else
constexpr nlink_t kScratchLinks = 0;
#endif

int publishPosixWav(int wavFd, int rootFd, const std::string &name) {
#ifdef __APPLE__
  // APFS clones the opened scratch file atomically and refuses an existing destination.
  const int result = fclonefileat(wavFd, rootFd, name.c_str(), 0);
#elif defined(__linux__)
  // Links an O_TMPFILE descriptor into rootFd atomically and refuses an existing destination.
  const std::string fdPath = "/proc/self/fd/" + std::to_string(wavFd);
  const int result = linkat(AT_FDCWD, fdPath.c_str(), rootFd, name.c_str(), AT_SYMLINK_FOLLOW);
#else
  (void)wavFd;
  (void)rootFd;
  (void)name;
  errno = ENOTSUP;
  const int result = -1;
#endif
  if (result == 0) return 0;
  const int code = errno;
  std::fprintf(stderr, "CONFINED_PUBLISH_FAILED: Atomic publication failed: %s\n",
               std::strerror(code));
  return code == EEXIST ? kExitTargetExists : kExitPublishFailed;
}

int runPosixConfinedRender(const ConfinedRenderOptions &options,
                           const std::string &csdText,
                           const std::string &csoundLibraryPath,
                           const std::vector<std::string> &csoundArguments) {
  PosixDirectories directories;
  directories.stagingFd = open(options.rootDir.c_str(), kDirectoryFlags);
  if (!isPosixDirectory(directories.stagingFd, options.expectedDev, options.expectedIno) ||
      fchdir(directories.stagingFd) != 0) {
    std::fprintf(stderr, "CONFINED_ROOT_MISMATCH: Private render directory changed\n");
    return kExitRootMismatch;
  }

  struct stat wavInfo {};
  if (fstat(STDOUT_FILENO, &wavInfo) != 0 || !S_ISREG(wavInfo.st_mode) ||
      wavInfo.st_nlink != kScratchLinks ||
      static_cast<uint64_t>(wavInfo.st_dev) != options.wavDev ||
      static_cast<uint64_t>(wavInfo.st_ino) != options.wavIno ||
      wavInfo.st_size != 0) {
    std::fprintf(stderr, "CONFINED_ROOT_MISMATCH: Owned WAV descriptor mismatch\n");
    return kExitRootMismatch;
  }

  return runStagedCsound(csdText, csoundLibraryPath, csoundArguments);
}

#else

bool utf8ToWide(const std::string &utf8, std::wstring &wide) {
  if (utf8.empty()) {
    wide.clear();
    return true;
  }
  const int needed = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
                                         utf8.c_str(), -1, nullptr, 0);
  if (needed <= 0) return false;
  wide.resize(static_cast<size_t>(needed));
  if (!MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.c_str(), -1,
                           wide.data(), needed)) return false;
  wide.pop_back();
  return true;
}

uint64_t fileIndex64(const BY_HANDLE_FILE_INFORMATION &info) {
  return (static_cast<uint64_t>(info.nFileIndexHigh) << 32) |
         static_cast<uint64_t>(info.nFileIndexLow);
}

uint64_t fileSize64(const BY_HANDLE_FILE_INFORMATION &info) {
  return (static_cast<uint64_t>(info.nFileSizeHigh) << 32) |
         static_cast<uint64_t>(info.nFileSizeLow);
}

bool getFinalHandlePath(HANDLE handle, std::wstring &outPath) {
  const DWORD needed =
      GetFinalPathNameByHandleW(handle, nullptr, 0, FILE_NAME_NORMALIZED);
  if (needed == 0) return false;
  outPath.assign(needed, L'\0');
  const DWORD written = GetFinalPathNameByHandleW(handle, outPath.data(), needed,
                                                  FILE_NAME_NORMALIZED);
  if (written == 0 || written >= needed) return false;
  outPath.resize(written);
  return true;
}

struct WinDirectories {
  HANDLE rootHandle = INVALID_HANDLE_VALUE;
  HANDLE stagingHandle = INVALID_HANDLE_VALUE;

  ~WinDirectories() {
    if (stagingHandle != INVALID_HANDLE_VALUE) CloseHandle(stagingHandle);
    if (rootHandle != INVALID_HANDLE_VALUE) CloseHandle(rootHandle);
  }
};

HANDLE openWinDirectory(const std::wstring &path, DWORD access) {
  return CreateFileW(path.c_str(), access, FILE_SHARE_READ | FILE_SHARE_WRITE,
                     nullptr, OPEN_EXISTING,
                     FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                     nullptr);
}

bool isWinDirectory(HANDLE handle, uint64_t dev, uint64_t ino) {
  BY_HANDLE_FILE_INFORMATION info {};
  return handle != INVALID_HANDLE_VALUE && GetFileInformationByHandle(handle, &info) &&
         (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0 &&
         (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) == 0 &&
         info.dwVolumeSerialNumber == dev && fileIndex64(info) == ino;
}

bool verifyWinOwnedWavHandle(HANDLE handle, uint64_t dev, uint64_t ino,
                             bool requireEmpty, uint64_t minBytes) {
  if (handle == INVALID_HANDLE_VALUE || handle == nullptr) return false;
  if (GetFileType(handle) != FILE_TYPE_DISK) return false;
  BY_HANDLE_FILE_INFORMATION info {};
  if (!GetFileInformationByHandle(handle, &info)) return false;
  if ((info.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) != 0) {
    return false;
  }
  if (info.nNumberOfLinks != 1 || info.dwVolumeSerialNumber != dev ||
      fileIndex64(info) != ino) {
    return false;
  }
  const uint64_t size = fileSize64(info);
  if (requireEmpty && size != 0) return false;
  if (size < minBytes) return false;
  return true;
}

int publishWinWav(HANDLE wav, HANDLE root, const std::wstring &name) {
  const size_t bytes = name.size() * sizeof(wchar_t);
  std::vector<unsigned char> buffer(sizeof(FILE_RENAME_INFO) + bytes);
  auto *rename = reinterpret_cast<FILE_RENAME_INFO *>(buffer.data());
  rename->ReplaceIfExists = FALSE;
  rename->RootDirectory = root;
  rename->FileNameLength = static_cast<DWORD>(bytes);
  std::memcpy(rename->FileName, name.c_str(), bytes + sizeof(wchar_t));
  // The Win32 wrapper rejects directory-relative names on Windows Server 2022.
  // Use the native rename class so the destination stays anchored to the handle.
  using SetInformationFile = NTSTATUS(NTAPI *)(HANDLE, PIO_STATUS_BLOCK, PVOID,
                                               ULONG, FILE_INFORMATION_CLASS);
  const auto setInformationFile = reinterpret_cast<SetInformationFile>(
      GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "NtSetInformationFile"));
  if (!setInformationFile) return kExitUnsupportedFs;

  constexpr auto renameInformation = static_cast<FILE_INFORMATION_CLASS>(10);
  constexpr auto nameCollision = static_cast<ULONG>(0xC0000035);
  IO_STATUS_BLOCK ioStatus {};
  const NTSTATUS status = setInformationFile(
      wav, &ioStatus, rename, static_cast<ULONG>(buffer.size()), renameInformation);
  if (status == 0) return 0;
  const auto error = static_cast<ULONG>(status);
  std::fprintf(stderr, "CONFINED_PUBLISH_FAILED: Atomic WAV publication failed (0x%08lx)\n",
               static_cast<unsigned long>(error));
  return error == nameCollision ? kExitTargetExists : kExitPublishFailed;
}

int runWinConfinedRender(const ConfinedRenderOptions &options,
                         const std::string &csdText,
                         const std::string &csoundLibraryPath,
                         const std::vector<std::string> &csoundArguments) {
  std::wstring stagePath;
  if (!utf8ToWide(options.rootDir, stagePath)) return kExitRootMismatch;
  WinDirectories directories;
  directories.stagingHandle = openWinDirectory(stagePath, FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES);
  if (!isWinDirectory(directories.stagingHandle, options.expectedDev, options.expectedIno) ||
      !getFinalHandlePath(directories.stagingHandle, stagePath) ||
      !SetCurrentDirectoryW(stagePath.c_str())) {
    std::fprintf(stderr, "CONFINED_ROOT_MISMATCH: Private render directory changed\n");
    return kExitRootMismatch;
  }

  HANDLE outHandle = GetStdHandle(STD_OUTPUT_HANDLE);
  if (!verifyWinOwnedWavHandle(outHandle, options.wavDev, options.wavIno, true, 0)) {
    std::fprintf(stderr, "CONFINED_ROOT_MISMATCH: Owned WAV descriptor mismatch\n");
    return kExitRootMismatch;
  }
  _setmode(_fileno(stdout), _O_BINARY);

  return runStagedCsound(csdText, csoundLibraryPath, csoundArguments);
}

int cleanupWinConfinedRender(const ConfinedRenderOptions &options) {
  if (options.hasRoot == options.hasWav) {
    std::fprintf(stderr,
                 "CONFINED_CLEANUP_REFUSED: Specify either owned WAV handle or staging directory\n");
    return kExitRootMismatch;
  }

  if (options.hasWav) {
    HANDLE inherited = GetStdHandle(STD_INPUT_HANDLE);
    if (!verifyWinOwnedWavHandle(inherited, options.wavDev, options.wavIno, false, 0)) {
      std::fprintf(stderr, "CONFINED_CLEANUP_REFUSED: Owned WAV descriptor mismatch\n");
      return kExitRootMismatch;
    }
    HANDLE delHandle = ReOpenFile(
        inherited, DELETE,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        FILE_FLAG_OPEN_REPARSE_POINT);
    if (delHandle == INVALID_HANDLE_VALUE) {
      std::fprintf(stderr,
                   "CONFINED_CLEANUP_FAILED: Could not reopen owned WAV handle (%lu)\n",
                   static_cast<unsigned long>(GetLastError()));
      return kExitPublishFailed;
    }
    FILE_DISPOSITION_INFO disposition {static_cast<BOOLEAN>(TRUE)};
    const BOOL ok = SetFileInformationByHandle(delHandle, FileDispositionInfo,
                                               &disposition, sizeof(disposition));
    const DWORD err = ok ? 0 : GetLastError();
    CloseHandle(delHandle);
    if (!ok) {
      std::fprintf(stderr,
                   "CONFINED_CLEANUP_FAILED: Could not mark owned WAV for deletion (%lu)\n",
                   static_cast<unsigned long>(err));
      return kExitPublishFailed;
    }
    return 0;
  }

  std::wstring stagePath;
  if (!utf8ToWide(options.rootDir, stagePath)) return kExitRootMismatch;
  WinDirectories guard;
  guard.stagingHandle = openWinDirectory(
      stagePath, DELETE | FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES);
  if (!isWinDirectory(guard.stagingHandle, options.expectedDev, options.expectedIno)) {
    std::fprintf(stderr, "CONFINED_CLEANUP_REFUSED: Staging directory identity mismatch\n");
    return kExitRootMismatch;
  }
  FILE_DISPOSITION_INFO disposition {static_cast<BOOLEAN>(TRUE)};
  if (!SetFileInformationByHandle(guard.stagingHandle, FileDispositionInfo,
                                  &disposition, sizeof(disposition))) {
    const DWORD err = GetLastError();
    if (err == ERROR_DIR_NOT_EMPTY) {
      std::fprintf(stderr,
                   "CONFINED_CLEANUP_PRESERVED: Staging directory contains unrelated entries\n");
      return kExitDirNotEmpty;
    }
    std::fprintf(stderr,
                 "CONFINED_CLEANUP_FAILED: Could not remove staging directory (%lu)\n",
                 static_cast<unsigned long>(err));
    return kExitPublishFailed;
  }
  return 0;
}

#endif

} // namespace

int runConfinedRender(const ConfinedRenderOptions &options,
                      const std::string &csoundLibraryPath,
                      const std::vector<std::string> &csoundArguments) {
  if (!options.hasRoot || !options.hasWav || options.wavDev != options.expectedDev) {
    std::fprintf(stderr,
                 "CONFINED_INVALID_ARGUMENT: Confined render requires matching root and WAV identities\n");
    return 64;
  }

#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY);
#endif
  std::string csdText;
  std::string readError;
  if (!readCsdFromStdin(csdText, readError)) {
    std::fprintf(stderr, "%s\n", readError.c_str());
    return 64;
  }

#ifdef _WIN32
  return runWinConfinedRender(options, csdText, csoundLibraryPath, csoundArguments);
#else
  return runPosixConfinedRender(options, csdText, csoundLibraryPath,
                                csoundArguments);
#endif
}

int publishConfinedRender(const ConfinedRenderOptions &options) {
  if (!options.hasRoot || !options.hasWav ||
      !isValidLeafWavName(options.outputName) ||
      options.wavDev != options.expectedDev) {
    return kExitUnsupportedFs;
  }
#ifdef _WIN32
  std::wstring rootPath, filename;
  if (!utf8ToWide(options.rootDir, rootPath) || !utf8ToWide(options.outputName, filename)) {
    return kExitRootMismatch;
  }
  WinDirectories guard;
  guard.rootHandle = openWinDirectory(rootPath, FILE_TRAVERSE | FILE_READ_ATTRIBUTES);
  if (!isWinDirectory(guard.rootHandle, options.expectedDev, options.expectedIno)) {
    return kExitRootMismatch;
  }
  HANDLE inherited = GetStdHandle(STD_INPUT_HANDLE);
  if (!verifyWinOwnedWavHandle(inherited, options.wavDev, options.wavIno, false, 44)) {
    return kExitPublishFailed;
  }
  HANDLE renameHandle = ReOpenFile(
      inherited, DELETE | FILE_READ_ATTRIBUTES,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      FILE_FLAG_OPEN_REPARSE_POINT);
  if (renameHandle == INVALID_HANDLE_VALUE) {
    std::fprintf(stderr,
                 "CONFINED_PUBLISH_FAILED: Could not reopen owned WAV handle (%lu)\n",
                 static_cast<unsigned long>(GetLastError()));
    return kExitPublishFailed;
  }
  const int result = publishWinWav(renameHandle, guard.rootHandle, filename);
  CloseHandle(renameHandle);
  return result;
#else
  PosixDirectories guard;
  guard.rootFd = open(options.rootDir.c_str(), kDirectoryFlags);
  if (!isPosixDirectory(guard.rootFd, options.expectedDev, options.expectedIno)) {
    return kExitRootMismatch;
  }
  struct stat info {};
  const bool valid = fstat(STDIN_FILENO, &info) == 0 && S_ISREG(info.st_mode) &&
                     info.st_nlink == kScratchLinks &&
                     static_cast<uint64_t>(info.st_dev) == options.wavDev &&
                     static_cast<uint64_t>(info.st_ino) == options.wavIno &&
                     info.st_size >= 44;
  return valid ? publishPosixWav(STDIN_FILENO, guard.rootFd, options.outputName)
               : kExitPublishFailed;
#endif
}

int allocateConfinedStaging(const ConfinedRenderOptions &options, const std::string &token) {
#if defined(__APPLE__) || defined(_WIN32)
  const auto &name = options.outputName;
  if (!options.hasRoot || name.rfind("blue-mcp-", 0) != 0 || name.size() > 100 ||
      name.find_first_not_of("abcdefghijklmnopqrstuvwxyz0123456789-.") != std::string::npos) {
    return kExitRootMismatch;
  }
#ifdef __APPLE__
  if (!isValidLeafWavName(name) || token.size() != 36 ||
      token.find_first_not_of("0123456789abcdef-") != std::string::npos) {
    return kExitRootMismatch;
  }
  PosixDirectories guard;
  guard.rootFd = open(options.rootDir.c_str(), kDirectoryFlags);
  if (!isPosixDirectory(guard.rootFd, options.expectedDev, options.expectedIno)) {
    return kExitRootMismatch;
  }
  struct attrlist attributes {};
  attributes.bitmapcount = ATTR_BIT_MAP_COUNT;
  attributes.volattr = ATTR_VOL_INFO | ATTR_VOL_CAPABILITIES;
  struct {
    uint32_t size;
    vol_capabilities_attr_t capabilities;
  } volume {};
  if (fgetattrlist(guard.rootFd, &attributes, &volume, sizeof(volume), 0) != 0 ||
      (volume.capabilities.valid[VOL_CAPABILITIES_INTERFACES] &
       volume.capabilities.capabilities[VOL_CAPABILITIES_INTERFACES] & VOL_CAP_INT_CLONE) == 0) {
    std::fprintf(stderr, "Render staging requires a filesystem with atomic file cloning\n");
    return kExitUnsupportedFs;
  }
  const int fd = openat(guard.rootFd, name.c_str(),
                        O_CREAT | O_EXCL | O_NOFOLLOW | O_RDWR | O_CLOEXEC, 0600);
  if (fd < 0) {
    std::fprintf(stderr, "Could not create private render scratch: %s\n", std::strerror(errno));
    return kExitPublishFailed;
  }
  struct stat info {};
  // A shared destination can apply inherited ACL entries despite mode 0600.
  const acl_t emptyAcl = acl_init(0);
  const bool privateAccess = emptyAcl && acl_set_fd_np(fd, emptyAcl, ACL_TYPE_EXTENDED) == 0;
  if (emptyAcl) acl_free(emptyAcl);
  const bool valid = privateAccess && fstat(fd, &info) == 0 && info.st_nlink == 1 &&
      fsetxattr(fd, "org.blue.mcp.render-scratch", token.data(), token.size(), 0, XATTR_CREATE) == 0 &&
      fsync(fd) == 0;
  close(fd);
  if (!valid) return kExitPublishFailed;
  std::printf("%" PRIu64 " %" PRIu64 "\n",
              static_cast<uint64_t>(info.st_dev), static_cast<uint64_t>(info.st_ino));
#else
  if (!token.empty() || name.back() == '.') return kExitRootMismatch;
  std::wstring rootPath, wideName;
  if (!utf8ToWide(options.rootDir, rootPath) || !utf8ToWide(name, wideName)) {
    return kExitRootMismatch;
  }
  WinDirectories guard;
  guard.rootHandle = openWinDirectory(rootPath, FILE_ADD_SUBDIRECTORY | FILE_TRAVERSE | FILE_READ_ATTRIBUTES);
  if (!isWinDirectory(guard.rootHandle, options.expectedDev, options.expectedIno)) {
    return kExitRootMismatch;
  }
  using CreateRelative = NTSTATUS(NTAPI *)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES,
      PIO_STATUS_BLOCK, PLARGE_INTEGER, ULONG, ULONG, ULONG, ULONG, PVOID, ULONG);
  const auto create = reinterpret_cast<CreateRelative>(
      GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "NtCreateFile"));
  if (!create) return kExitUnsupportedFs;

  UNICODE_STRING leafName {};
  leafName.Buffer = wideName.data();
  leafName.Length = static_cast<USHORT>(wideName.size() * sizeof(wchar_t));
  leafName.MaximumLength = leafName.Length;
  OBJECT_ATTRIBUTES attributes {};
  attributes.Length = sizeof(attributes);
  attributes.RootDirectory = guard.rootHandle;
  attributes.ObjectName = &leafName;
  attributes.Attributes = 0x40; // OBJ_CASE_INSENSITIVE
  DWORD filesystemFlags = 0;
  if (!GetVolumeInformationByHandleW(guard.rootHandle, nullptr, 0, nullptr, nullptr,
                                    &filesystemFlags, nullptr, 0) ||
      (filesystemFlags & FILE_PERSISTENT_ACLS) == 0) {
    std::fprintf(stderr, "Render staging requires a filesystem with persistent access controls\n");
    return kExitUnsupportedFs;
  }
  PSECURITY_DESCRIPTOR privateAccess = nullptr;
  // Protect the staging directory and its files from the destination's inherited ACL.
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
          L"D:P(A;OICI;FA;;;OW)(A;OICI;FA;;;SY)", SDDL_REVISION_1, &privateAccess, nullptr)) {
    return kExitPublishFailed;
  }
  attributes.SecurityDescriptor = privateAccess;
  IO_STATUS_BLOCK result {};
  constexpr ULONG createNew = 2;            // FILE_CREATE
  constexpr ULONG directorySync = 0x21;     // FILE_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT
  const auto status = create(&guard.stagingHandle, FILE_READ_ATTRIBUTES | SYNCHRONIZE,
      &attributes, &result, nullptr, FILE_ATTRIBUTE_NORMAL,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, createNew, directorySync, nullptr, 0);
  LocalFree(privateAccess);
  BY_HANDLE_FILE_INFORMATION info {};
  if (status != 0 || !GetFileInformationByHandle(guard.stagingHandle, &info)) {
    std::fprintf(stderr, "Could not create private render staging directory (0x%08lx)\n",
                 static_cast<unsigned long>(status));
    return kExitPublishFailed;
  }
  std::printf("%" PRIu64 " %" PRIu64 "\n",
              static_cast<uint64_t>(info.dwVolumeSerialNumber), fileIndex64(info));
#endif
  return 0;
#else
  (void)options;
  (void)token;
  return kExitUnsupportedFs;
#endif
}

int cleanupConfinedRender(const ConfinedRenderOptions &options) {
#ifdef _WIN32
  return cleanupWinConfinedRender(options);

#else
  // Linux owns an anonymous O_TMPFILE. Closing its descriptor completes cleanup.
  (void)options;
  std::fprintf(stderr, "CONFINED_CLEANUP_REFUSED: Named staging cleanup is unsupported\n");
  return kExitUnsupportedFs;
#endif
}

} // namespace blue
