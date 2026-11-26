#include "ConfinedRender.h"

#include "CsoundLoader.h"
#include "CsoundRuntimeServices.h"

#include <cerrno>
#include <cstdio>
#include <fcntl.h>
#include <cstring>
#include <string>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#include <io.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#ifdef __APPLE__
#include <sys/clonefile.h>
#endif
#endif

namespace blue {
namespace {

constexpr size_t kMaxCsdBytes = 4 * 1024 * 1024;
constexpr int kExitRootMismatch = 70;
constexpr int kExitTargetExists = 71;
constexpr int kExitUnsupportedFs = 72;
constexpr int kExitPublishFailed = 73;

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

int runStagedCsound(const std::string &outputName,
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

  std::vector<std::string> fullArgs = csoundArguments;
  fullArgs.emplace_back("-o");
  fullArgs.push_back(outputName);
  fullArgs.emplace_back("render.csd");
  const int result = CsoundRuntimeServices::runPerformance(csound, fullArgs, onMessage);
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

int publishPosixWav(int wavFd, int rootFd, const std::string &name) {
#ifdef __APPLE__
  // APFS clones the opened file atomically and refuses an existing destination.
  const int result = fclonefileat(wavFd, rootFd, name.c_str(), 0);
#elif defined(__linux__)
  // Following this procfs entry links the file descriptor, even if its old name changed.
  const std::string fdPath = "/proc/self/fd/" + std::to_string(wavFd);
  const int result = linkat(AT_FDCWD, fdPath.c_str(), rootFd, name.c_str(), AT_SYMLINK_FOLLOW);
#else
  errno = ENOTSUP;
  const int result = -1;
#endif
  if (result == 0) return 0;
  const int code = errno;
  std::fprintf(stderr, "CONFINED_PUBLISH_FAILED: Atomic publication failed: %s\n",
               std::strerror(code));
  return code == EEXIST ? kExitTargetExists : kExitPublishFailed;
}

bool writeAllFd(int fd, const std::string &data) {
  size_t writtenTotal = 0;
  while (writtenTotal < data.size()) {
    const ssize_t n =
        write(fd, data.data() + writtenTotal, data.size() - writtenTotal);
    if (n <= 0) {
      if (n < 0 && errno == EINTR) continue;
      return false;
    }
    writtenTotal += static_cast<size_t>(n);
  }
  return true;
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

  const int csdFd = openat(directories.stagingFd, "render.csd",
                            O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (csdFd < 0) return kExitPublishFailed;
  const bool written = writeAllFd(csdFd, csdText);
  close(csdFd);
  if (!written) return kExitPublishFailed;
  return runStagedCsound(options.outputName, csoundLibraryPath, csoundArguments);
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

int publishWinWav(HANDLE wav, HANDLE root, const std::wstring &name) {
  const size_t bytes = name.size() * sizeof(wchar_t);
  std::vector<unsigned char> buffer(sizeof(FILE_RENAME_INFO) + bytes);
  auto *rename = reinterpret_cast<FILE_RENAME_INFO *>(buffer.data());
  rename->ReplaceIfExists = FALSE;
  rename->RootDirectory = root;
  rename->FileNameLength = static_cast<DWORD>(bytes);
  std::memcpy(rename->FileName, name.c_str(), bytes + sizeof(wchar_t));
  if (SetFileInformationByHandle(wav, FileRenameInfo, rename, static_cast<DWORD>(buffer.size()))) {
    return 0;
  }
  const DWORD error = GetLastError();
  std::fprintf(stderr, "CONFINED_PUBLISH_FAILED: Atomic WAV publication failed (%lu)\n",
               static_cast<unsigned long>(error));
  return error == ERROR_ALREADY_EXISTS || error == ERROR_FILE_EXISTS
      ? kExitTargetExists : kExitPublishFailed;
}

int runWinConfinedRender(const ConfinedRenderOptions &options,
                         const std::string &csdText,
                         const std::string &csoundLibraryPath,
                         const std::vector<std::string> &csoundArguments) {
  std::wstring stagePath;
  if (!utf8ToWide(options.rootDir, stagePath)) return kExitRootMismatch;
  WinDirectories directories;
  directories.stagingHandle = openWinDirectory(stagePath, FILE_LIST_DIRECTORY | FILE_ADD_FILE);
  if (!isWinDirectory(directories.stagingHandle, options.expectedDev, options.expectedIno) ||
      !getFinalHandlePath(directories.stagingHandle, stagePath) ||
      !SetCurrentDirectoryW(stagePath.c_str())) {
    std::fprintf(stderr, "CONFINED_ROOT_MISMATCH: Private render directory changed\n");
    return kExitRootMismatch;
  }

  HANDLE csd = CreateFileW(L"render.csd", GENERIC_WRITE, 0, nullptr,
                           CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (csd == INVALID_HANDLE_VALUE) return kExitPublishFailed;
  DWORD bytesWritten = 0;
  const BOOL wrote = WriteFile(csd, csdText.data(), static_cast<DWORD>(csdText.size()),
                               &bytesWritten, nullptr);
  CloseHandle(csd);
  if (!wrote || bytesWritten != csdText.size()) return kExitPublishFailed;
  return runStagedCsound(options.outputName, csoundLibraryPath, csoundArguments);
}

#endif

} // namespace

int runConfinedRender(const ConfinedRenderOptions &options,
                      const std::string &csoundLibraryPath,
                      const std::vector<std::string> &csoundArguments) {
  if (!isValidLeafWavName(options.outputName)) {
    std::fprintf(stderr,
                 "CONFINED_INVALID_ARGUMENT: Output filename must be a safe "
                 "single-leaf .wav filename\n");
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

int publishConfinedRender(const ConfinedRenderOptions &options,
                          const std::string &stagingDir, uint64_t stagingDev,
                          uint64_t stagingIno, uint64_t wavIno) {
  if (!isValidLeafWavName(options.outputName) || stagingDev != options.expectedDev) {
    return kExitUnsupportedFs;
  }
#ifdef _WIN32
  std::wstring rootPath, stagePath, filename;
  if (!utf8ToWide(options.rootDir, rootPath) || !utf8ToWide(stagingDir, stagePath) ||
      !utf8ToWide(options.outputName, filename)) {
    return kExitRootMismatch;
  }
  WinDirectories guard;
  guard.rootHandle = openWinDirectory(rootPath, FILE_LIST_DIRECTORY | FILE_ADD_FILE);
  guard.stagingHandle = openWinDirectory(stagePath, FILE_LIST_DIRECTORY);
  if (!isWinDirectory(guard.rootHandle, options.expectedDev, options.expectedIno) ||
      !isWinDirectory(guard.stagingHandle, stagingDev, stagingIno) ||
      !getFinalHandlePath(guard.stagingHandle, stagePath)) {
    return kExitRootMismatch;
  }
  const std::wstring wavPath = stagePath + L"\\render.wav";
  HANDLE wav = CreateFileW(wavPath.c_str(), GENERIC_READ | DELETE, FILE_SHARE_READ,
                           nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (wav == INVALID_HANDLE_VALUE) return kExitPublishFailed;
  BY_HANDLE_FILE_INFORMATION info {};
  const bool valid = GetFileType(wav) == FILE_TYPE_DISK &&
                     GetFileInformationByHandle(wav, &info) &&
                     (info.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) == 0 &&
                     info.nNumberOfLinks == 1 && info.dwVolumeSerialNumber == stagingDev &&
                     fileIndex64(info) == wavIno;
  const int result = valid ? publishWinWav(wav, guard.rootHandle, filename) : kExitPublishFailed;
  CloseHandle(wav);
  return result;
#else
  PosixDirectories guard;
  guard.rootFd = open(options.rootDir.c_str(), kDirectoryFlags);
  guard.stagingFd = open(stagingDir.c_str(), kDirectoryFlags);
  if (!isPosixDirectory(guard.rootFd, options.expectedDev, options.expectedIno) ||
      !isPosixDirectory(guard.stagingFd, stagingDev, stagingIno)) {
    return kExitRootMismatch;
  }
  const int wav = openat(guard.stagingFd, "render.wav",
                          O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (wav < 0) return kExitPublishFailed;
  struct stat info {};
  const bool valid = fstat(wav, &info) == 0 && S_ISREG(info.st_mode) && info.st_nlink == 1 &&
                     static_cast<uint64_t>(info.st_dev) == stagingDev &&
                     static_cast<uint64_t>(info.st_ino) == wavIno;
  const int result = valid ? publishPosixWav(wav, guard.rootFd, options.outputName) : kExitPublishFailed;
  close(wav);
  return result;
#endif
}

} // namespace blue
