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
};

int runConfinedRender(const ConfinedRenderOptions &options,
                      const std::string &csoundLibraryPath,
                      const std::vector<std::string> &csoundArguments);

int publishConfinedRender(const ConfinedRenderOptions &options,
                          const std::string &stagingDir, uint64_t stagingDev,
                          uint64_t stagingIno, uint64_t wavIno);

} // namespace blue
