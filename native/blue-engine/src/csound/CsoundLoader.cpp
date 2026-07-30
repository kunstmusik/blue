#include "CsoundLoader.h"

#include <algorithm>
#include <cstdlib>
#include <utility>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#else
#include <dlfcn.h>
#endif

namespace blue {

csound::csoundGetVersion_t CsoundLoader::csoundGetVersion = nullptr;
csound::csoundInitialize_t CsoundLoader::csoundInitialize = nullptr;
csound::csoundCreate_t CsoundLoader::csoundCreate = nullptr;
csound::csoundDestroy_t CsoundLoader::csoundDestroy = nullptr;
csound::csoundReset_t CsoundLoader::csoundReset = nullptr;
csound::csoundSetOption_t CsoundLoader::csoundSetOption = nullptr;
csound::csoundCompileOrc_t CsoundLoader::csoundCompileOrc = nullptr;
csound::csoundStart_t CsoundLoader::csoundStart = nullptr;
csound::csoundPerformKsmps_t CsoundLoader::csoundPerformKsmps = nullptr;
csound::csoundEventString_t CsoundLoader::csoundEventString = nullptr;
csound::csoundGetSr_t CsoundLoader::csoundGetSr = nullptr;
csound::csoundGetKsmps_t CsoundLoader::csoundGetKsmps = nullptr;
csound::csoundGetChannelPtr_t CsoundLoader::csoundGetChannelPtr = nullptr;
csound::csoundListChannels_t CsoundLoader::csoundListChannels = nullptr;
csound::csoundDeleteChannelList_t CsoundLoader::csoundDeleteChannelList = nullptr;
csound::csoundGetControlChannel_t CsoundLoader::csoundGetControlChannel = nullptr;
csound::csoundSetControlChannel_t CsoundLoader::csoundSetControlChannel = nullptr;

namespace {

struct LoaderState {
  void *libraryHandle = nullptr;
  bool loadAttempted = false;
  bool initialized = false;
  CsoundLoadReport report;
};

LoaderState &state() {
  static LoaderState loaderState;
  return loaderState;
}

#ifdef _WIN32

void *openLibrary(const std::string &path) {
  return LoadLibraryExA(path.c_str(), nullptr,
                        LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR |
                            LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
}

void closeLibrary(void *handle) {
  if (handle) {
    FreeLibrary(static_cast<HMODULE>(handle));
  }
}

void *getSymbol(void *handle, const char *name) {
  return reinterpret_cast<void *>(
      GetProcAddress(static_cast<HMODULE>(handle), name));
}

std::string loaderError() {
  const DWORD error = GetLastError();
  if (error == 0) {
    return "";
  }
  LPSTR buffer = nullptr;
  FormatMessageA(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM,
                 nullptr, error, 0, reinterpret_cast<LPSTR>(&buffer), 0,
                 nullptr);
  const std::string result = buffer ? buffer : "Unknown Windows loader error";
  LocalFree(buffer);
  return result;
}

#else

void *openLibrary(const std::string &path) {
  return dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
}

void closeLibrary(void *handle) {
  if (handle) {
    dlclose(handle);
  }
}

void *getSymbol(void *handle, const char *name) { return dlsym(handle, name); }

std::string loaderError() {
  const char *error = dlerror();
  return error ? error : "";
}

#endif

void clearSymbols() {
  CsoundLoader::csoundGetVersion = nullptr;
  CsoundLoader::csoundInitialize = nullptr;
  CsoundLoader::csoundCreate = nullptr;
  CsoundLoader::csoundDestroy = nullptr;
  CsoundLoader::csoundReset = nullptr;
  CsoundLoader::csoundSetOption = nullptr;
  CsoundLoader::csoundCompileOrc = nullptr;
  CsoundLoader::csoundStart = nullptr;
  CsoundLoader::csoundPerformKsmps = nullptr;
  CsoundLoader::csoundEventString = nullptr;
  CsoundLoader::csoundGetSr = nullptr;
  CsoundLoader::csoundGetKsmps = nullptr;
  CsoundLoader::csoundGetChannelPtr = nullptr;
  CsoundLoader::csoundListChannels = nullptr;
  CsoundLoader::csoundDeleteChannelList = nullptr;
  CsoundLoader::csoundGetControlChannel = nullptr;
  CsoundLoader::csoundSetControlChannel = nullptr;
}

template <typename T>
void loadRequiredSymbol(void *handle, const char *name, T &destination,
                        std::vector<std::string> &missingSymbols) {
  destination = reinterpret_cast<T>(getSymbol(handle, name));
  if (!destination) {
    missingSymbols.emplace_back(name);
  }
}

bool loadAllSymbols(void *handle, std::vector<std::string> &missingSymbols) {
  clearSymbols();
  loadRequiredSymbol(handle, "csoundGetVersion",
                     CsoundLoader::csoundGetVersion, missingSymbols);
  loadRequiredSymbol(handle, "csoundInitialize", CsoundLoader::csoundInitialize,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundCreate", CsoundLoader::csoundCreate,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundDestroy", CsoundLoader::csoundDestroy,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundReset", CsoundLoader::csoundReset,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundSetOption", CsoundLoader::csoundSetOption,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundCompileOrc", CsoundLoader::csoundCompileOrc,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundStart", CsoundLoader::csoundStart,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundPerformKsmps",
                     CsoundLoader::csoundPerformKsmps, missingSymbols);
  loadRequiredSymbol(handle, "csoundEventString",
                     CsoundLoader::csoundEventString, missingSymbols);
  loadRequiredSymbol(handle, "csoundGetSr", CsoundLoader::csoundGetSr,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundGetKsmps", CsoundLoader::csoundGetKsmps,
                     missingSymbols);
  loadRequiredSymbol(handle, "csoundGetChannelPtr",
                     CsoundLoader::csoundGetChannelPtr, missingSymbols);
  loadRequiredSymbol(handle, "csoundListChannels",
                     CsoundLoader::csoundListChannels, missingSymbols);
  loadRequiredSymbol(handle, "csoundDeleteChannelList",
                     CsoundLoader::csoundDeleteChannelList, missingSymbols);
  loadRequiredSymbol(handle, "csoundGetControlChannel",
                     CsoundLoader::csoundGetControlChannel, missingSymbols);
  loadRequiredSymbol(handle, "csoundSetControlChannel",
                     CsoundLoader::csoundSetControlChannel, missingSymbols);
  return missingSymbols.empty();
}

void appendUnique(std::vector<std::string> &paths, std::string path) {
  if (path.empty() ||
      std::find(paths.begin(), paths.end(), path) != paths.end()) {
    return;
  }
  paths.push_back(std::move(path));
}

} // namespace

std::vector<std::string>
CsoundLoader::candidatePaths(const std::string &explicitPath,
                             const std::string &environmentPath) {
  std::vector<std::string> paths;
  appendUnique(paths, explicitPath);
  if (!paths.empty()) {
    return paths;
  }
  appendUnique(paths, environmentPath);
  if (!paths.empty()) {
    return paths;
  }

#if defined(__APPLE__)
  const char *home = std::getenv("HOME");
  return platformCandidatePaths("darwin", home ? home : "", "");
#elif defined(_WIN32)
  const char *programFiles = std::getenv("ProgramFiles");
  return platformCandidatePaths("win32", "", programFiles ? programFiles : "");
#else
  return platformCandidatePaths("linux");
#endif
}

std::vector<std::string>
CsoundLoader::platformCandidatePaths(
    const std::string &platform, const std::string &homeDirectory,
    const std::string &programFilesDirectory) {
  std::vector<std::string> paths;
  if (platform == "darwin") {
    appendUnique(paths,
                 "/Library/Frameworks/CsoundLib64.framework/CsoundLib64");
    if (!homeDirectory.empty() && homeDirectory.front() == '/') {
      appendUnique(paths, homeDirectory +
                              "/Library/Frameworks/CsoundLib64.framework/"
                              "CsoundLib64");
    }
    appendUnique(paths, "/opt/homebrew/lib/libcsound64.dylib");
    appendUnique(paths, "/usr/local/lib/libcsound64.dylib");
    return paths;
  }
  if (platform == "win32") {
    const bool absoluteDrivePath =
        programFilesDirectory.size() >= 3 &&
        ((programFilesDirectory[0] >= 'A' &&
          programFilesDirectory[0] <= 'Z') ||
         (programFilesDirectory[0] >= 'a' &&
          programFilesDirectory[0] <= 'z')) &&
        programFilesDirectory[1] == ':' &&
        (programFilesDirectory[2] == '\\' ||
         programFilesDirectory[2] == '/');
    if (absoluteDrivePath) {
      appendUnique(paths, programFilesDirectory +
                              "\\Csound7_x64\\bin\\csound64.dll");
      appendUnique(paths,
                   programFilesDirectory + "\\Csound\\bin\\csound64.dll");
    }
    return paths;
  }
  if (platform == "linux") {
  const std::vector<std::string> directories = {
      "/usr/lib", "/usr/lib64", "/usr/local/lib",
      "/usr/lib/x86_64-linux-gnu", "/usr/lib/aarch64-linux-gnu"};
  const std::vector<std::string> names = {
      "libcsound64.so", "libcsound64.so.7", "libcsound64.so.7.0"};
  for (const auto &directory : directories) {
    for (const auto &name : names) {
      appendUnique(paths, directory + "/" + name);
    }
  }
  }
  return paths;
}

bool CsoundLoader::load(const std::string &explicitPath) {
  auto &loaderState = state();
  if (loaderState.loadAttempted) {
    return loaderState.libraryHandle != nullptr;
  }
  loaderState.loadAttempted = true;
  loaderState.report = CsoundLoadReport{};
  const char *environment = std::getenv("LIBCSOUND_PATH");
  const std::string environmentPath =
      environment && environment[0] != '\0' ? environment : "";
  loaderState.report.requestedPath =
      explicitPath.empty() ? environmentPath : explicitPath;
  const auto paths = candidatePaths(explicitPath, environmentPath);
  bool openedAnyLibrary = false;
  std::string lastLoaderError;

  for (const auto &path : paths) {
    void *handle = openLibrary(path);
    if (!handle) {
      lastLoaderError = loaderError();
      continue;
    }
    openedAnyLibrary = true;

    std::vector<std::string> missingSymbols;
    if (!loadAllSymbols(handle, missingSymbols)) {
      loaderState.report.status = CsoundLoadStatus::MISSING_SYMBOLS;
      loaderState.report.loadedPath = path;
      loaderState.report.missingSymbols = std::move(missingSymbols);
      closeLibrary(handle);
      clearSymbols();
      continue;
    }

    const int version = csoundGetVersion();
    const int major = version / 1000;
    if (!isSupportedVersion(version)) {
      loaderState.report.status = CsoundLoadStatus::UNSUPPORTED_VERSION;
      loaderState.report.loadedPath = path;
      loaderState.report.versionRaw = version;
      loaderState.report.major = major;
      loaderState.report.minor = (version / 10) % 100;
      loaderState.report.patch = version % 10;
      loaderState.report.message =
          "Unsupported Csound major version " + std::to_string(major) +
          "; Blue Engine requires Csound 7";
      closeLibrary(handle);
      clearSymbols();
      continue;
    }

    loaderState.libraryHandle = handle;
    loaderState.report.status = CsoundLoadStatus::READY;
    loaderState.report.loadedPath = path;
    loaderState.report.versionRaw = version;
    loaderState.report.major = major;
    loaderState.report.minor = (version / 10) % 100;
    loaderState.report.patch = version % 10;
    loaderState.report.missingSymbols.clear();
    loaderState.report.message = "Csound 7 is ready";
    return true;
  }

  if (loaderState.report.status == CsoundLoadStatus::MISSING_SYMBOLS) {
    loaderState.report.message = "Csound library is missing required symbols";
  } else if (loaderState.report.status ==
             CsoundLoadStatus::UNSUPPORTED_VERSION) {
    // Retain the version-specific message produced above.
  } else if (openedAnyLibrary) {
    loaderState.report.status = CsoundLoadStatus::LOAD_FAILED;
    loaderState.report.message = "Csound library could not be initialized";
  } else {
    loaderState.report.status =
        explicitPath.empty() ? CsoundLoadStatus::NOT_FOUND
                             : CsoundLoadStatus::LOAD_FAILED;
    loaderState.report.message =
        explicitPath.empty() ? "No supported Csound library was found"
                             : "The requested Csound library could not be loaded";
  }
  if (!lastLoaderError.empty()) {
    loaderState.report.message += ": " + lastLoaderError;
  }
  return false;
}

bool CsoundLoader::initialize() {
  auto &loaderState = state();
  if (loaderState.initialized) {
    return true;
  }
  if (!load() || !csoundInitialize) {
    return false;
  }
  const int result =
      csoundInitialize(csound::CSOUNDINIT_NO_SIGNAL_HANDLER |
                       csound::CSOUNDINIT_NO_ATEXIT);
  if (result != csound::CSOUND_SUCCESS) {
    loaderState.report.status = CsoundLoadStatus::INTERNAL_ERROR;
    loaderState.report.message = "Csound initialization failed";
    return false;
  }
  loaderState.initialized = true;
  return true;
}

const CsoundLoadReport &CsoundLoader::getReport() { return state().report; }

bool CsoundLoader::isSupportedVersion(int versionRaw) {
  return versionRaw / 1000 == 7;
}

const char *CsoundLoader::statusName(CsoundLoadStatus status) {
  switch (status) {
  case CsoundLoadStatus::READY:
    return "ready";
  case CsoundLoadStatus::NOT_FOUND:
    return "not-found";
  case CsoundLoadStatus::LOAD_FAILED:
    return "load-failed";
  case CsoundLoadStatus::MISSING_SYMBOLS:
    return "missing-symbols";
  case CsoundLoadStatus::UNSUPPORTED_VERSION:
    return "unsupported-version";
  case CsoundLoadStatus::INTERNAL_ERROR:
    return "internal-error";
  }
  return "internal-error";
}

bool CsoundLoader::isLoaded() { return state().libraryHandle != nullptr; }

const std::string &CsoundLoader::getError() { return state().report.message; }

const std::string &CsoundLoader::getLoadedPath() {
  return state().report.loadedPath;
}

void CsoundLoader::unload() {
  auto &loaderState = state();
  closeLibrary(loaderState.libraryHandle);
  loaderState = LoaderState{};
  clearSymbols();
}

} // namespace blue
