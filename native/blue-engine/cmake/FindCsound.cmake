# FindCsound.cmake
# Locate Csound library and headers
#
# This module defines:
#   CSOUND_FOUND        - True if Csound was found
#   CSOUND_INCLUDE_DIRS - Include directories for Csound
#   CSOUND_LIBRARIES    - Libraries to link against

# Check for macOS framework first
if(APPLE)
    find_library(CSOUND_FRAMEWORK CsoundLib64
        PATHS /Library/Frameworks
        NO_DEFAULT_PATH
    )

    if(CSOUND_FRAMEWORK)
        set(CSOUND_FOUND TRUE)
        set(CSOUND_LIBRARIES ${CSOUND_FRAMEWORK})
        set(CSOUND_INCLUDE_DIRS "${CSOUND_FRAMEWORK}/Headers")
        # Extract framework directory for rpath
        get_filename_component(CSOUND_RPATH "${CSOUND_FRAMEWORK}" DIRECTORY)
        message(STATUS "Found Csound framework: ${CSOUND_FRAMEWORK}")
        message(STATUS "Csound RPATH: ${CSOUND_RPATH}")
        return()
    endif()
endif()

# Fall back to standard library search
find_path(CSOUND_INCLUDE_DIR
    NAMES csound.h
    PATHS
        /usr/local/include/csound
        /usr/include/csound
        /opt/homebrew/include/csound
        $ENV{CSOUND_HOME}/include
)

find_library(CSOUND_LIBRARY
    NAMES csound64 csound CsoundLib64
    PATHS
        /usr/local/lib
        /usr/lib
        /opt/homebrew/lib
        $ENV{CSOUND_HOME}/lib
)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(Csound
    REQUIRED_VARS CSOUND_LIBRARY CSOUND_INCLUDE_DIR
)

if(CSOUND_FOUND)
    set(CSOUND_LIBRARIES ${CSOUND_LIBRARY})
    set(CSOUND_INCLUDE_DIRS ${CSOUND_INCLUDE_DIR})
    # Extract library directory for rpath
    get_filename_component(CSOUND_RPATH "${CSOUND_LIBRARY}" DIRECTORY)
endif()

mark_as_advanced(CSOUND_INCLUDE_DIR CSOUND_LIBRARY)
