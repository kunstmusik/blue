#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace blue {

struct ConfinedRenderOptions {
  std::string rootDir;
  uint64_t expectedDev = 0;
  uint64_t expectedIno = 0;
  std::string outputName;
  uint64_t wavDev = 0;
  uint64_t wavIno = 0;
  bool hasRoot = false;
  bool hasWav = false;
};

int runConfinedRender(const ConfinedRenderOptions &options,
                      const std::string &csoundLibraryPath,
                      const std::vector<std::string> &csoundArguments);

int publishConfinedRender(const ConfinedRenderOptions &options);

int cleanupConfinedRender(const ConfinedRenderOptions &options);

} // namespace blue
