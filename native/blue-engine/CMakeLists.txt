cmake_minimum_required(VERSION 3.21)
project(blue-engine VERSION 0.1.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(WIN32)
    add_compile_definitions(NOMINMAX WIN32_LEAN_AND_MEAN)
endif()

# Options

# Find dependencies
# Note: Csound is loaded dynamically at runtime via dlopen, no find_package needed

# Enable low-overhead runtime performance tracking in the perform thread.
option(USE_PERFORMANCE_TRACKING "Enable blue-engine runtime performance tracking" OFF)
if(USE_PERFORMANCE_TRACKING)
    set(BLUE_ENGINE_PERFORMANCE_TRACKING_VALUE 1)
    message(STATUS "blue-engine performance tracking enabled (BLUE_ENGINE_USE_PERFORMANCE_TRACKING=1)")
else()
    set(BLUE_ENGINE_PERFORMANCE_TRACKING_VALUE 0)
endif()

# Optional build-level optimizations evaluated behind benchmark gates
option(ENABLE_IPO "Enable Interprocedural Optimization (IPO/LTO)" OFF)
if(ENABLE_IPO)
    include(CheckIPOSupported)
    check_ipo_supported(RESULT ipo_supported OUTPUT ipo_error)
    if(ipo_supported)
        set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
        message(STATUS "IPO/LTO enabled")
    else()
        message(WARNING "IPO/LTO not supported: ${ipo_error}")
    endif()
endif()

option(ENABLE_NO_MATH_ERRNO "Enable -fno-math-errno in Release builds" OFF)
if(ENABLE_NO_MATH_ERRNO AND (CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU"))
    add_compile_options("$<$<CONFIG:Release>:-fno-math-errno>")
    message(STATUS "-fno-math-errno enabled for Release builds")
endif()

# Release artifacts require the static target supplied by the pinned vcpkg
# manifest. A missing static target is an error; there is no pkg-config or
# dynamic-library fallback.
find_package(ZeroMQ CONFIG REQUIRED)
if(NOT TARGET libzmq-static)
    message(FATAL_ERROR "The vcpkg ZeroMQ package did not provide libzmq-static")
endif()

# Header-only Boost.Multiprecision backs the private exact-decimal automation
# modules (JavaBigDecimal/ExactDecimalQuantizer). No Boost linkage is required
# beyond the headers; the feature-owned arena keeps audio-path use allocation
# free after control-thread preparation.
find_package(Boost CONFIG REQUIRED)

# Floating-point parity controls: the Java-linear automation translation unit
# must not use fused multiply-add contraction or algebraic reassociation.
# Only the parity unit is restricted; unrelated DSP/host code is untouched.
set(BLUE_ENGINE_PARITY_SOURCES
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    foreach(parity_source ${BLUE_ENGINE_PARITY_SOURCES})
        set_source_files_properties(${parity_source} PROPERTIES
            COMPILE_OPTIONS "-ffp-contract=off;-fno-associative-math")
    endforeach()
elseif(MSVC)
    # /fp:precise is MSVC's documented mode that disallows contraction and
    # reassociation of floating-point expressions.
    foreach(parity_source ${BLUE_ENGINE_PARITY_SOURCES})
        set_source_files_properties(${parity_source} PROPERTIES
            COMPILE_OPTIONS "/fp:precise")
    endforeach()
endif()

# =============================================================================
# Java parity fixture corpus (canonical copy for CTest)
# =============================================================================
# The committed corpus at the repository root is the single authority for
# native exact-bit expectations. CMake copies it into the build tree and
# injects the copy's path so tests never parse relative to their cwd and no
# native JSON dependency is introduced.
set(BLUE_ENGINE_PARITY_FIXTURES_SOURCE_DIR
    "${CMAKE_SOURCE_DIR}/../../fixtures/java-blue-automation-parity/v1")
set(BLUE_ENGINE_PARITY_FIXTURES_DIR
    "${CMAKE_BINARY_DIR}/parity-fixtures/java-blue-automation-parity/v1")
if(NOT EXISTS "${BLUE_ENGINE_PARITY_FIXTURES_SOURCE_DIR}/manifest.json")
    message(FATAL_ERROR
        "Java parity fixture corpus missing: ${BLUE_ENGINE_PARITY_FIXTURES_SOURCE_DIR}/manifest.json")
endif()
file(COPY "${BLUE_ENGINE_PARITY_FIXTURES_SOURCE_DIR}/" DESTINATION
    "${BLUE_ENGINE_PARITY_FIXTURES_DIR}")

# Main executable
add_executable(blue-engine
    src/main.cpp
    src/engine/CsoundEngine.cpp
    src/ipc/ZmqHandler.cpp
    src/ipc/SharedMemory.cpp
    src/csound/CsoundLoader.cpp
    src/csound/CsoundRuntimeServices.cpp
    src/automation/AutomationStore.cpp
    src/automation/AutomationManager.cpp
    src/automation/JavaBigDecimal.cpp
    src/automation/ExactDecimalQuantizer.cpp
    src/protocol/Capabilities.cpp
    src/process/OwnerMonitor.cpp
)

set(BLUE_ENGINE_SOURCE_REVISION "unknown" CACHE STRING
    "Source revision embedded in engine capabilities")
target_compile_definitions(blue-engine PRIVATE
    BLUE_ENGINE_USE_PERFORMANCE_TRACKING=${BLUE_ENGINE_PERFORMANCE_TRACKING_VALUE}
    BLUE_ENGINE_SOURCE_REVISION="${BLUE_ENGINE_SOURCE_REVISION}"
)

target_include_directories(blue-engine PRIVATE
    ${CMAKE_SOURCE_DIR}/src
)

target_link_libraries(blue-engine PRIVATE libzmq-static Boost::boost)
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(blue-engine PRIVATE -ffp-contract=off -fno-associative-math)
elseif(MSVC)
    target_compile_options(blue-engine PRIVATE /fp:precise)
endif()

# Benchmark executable
add_executable(benchmark_engine
    src/benchmark_main.cpp
    src/engine/CsoundEngine.cpp
    src/csound/CsoundLoader.cpp
    src/ipc/SharedMemory.cpp
    src/automation/AutomationStore.cpp
    src/automation/AutomationManager.cpp
    src/automation/JavaBigDecimal.cpp
    src/automation/ExactDecimalQuantizer.cpp
)
target_include_directories(benchmark_engine PRIVATE
    ${CMAKE_SOURCE_DIR}/src
)
target_link_libraries(benchmark_engine PRIVATE libzmq-static Boost::boost)
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(benchmark_engine PRIVATE -ffp-contract=off -fno-associative-math)
elseif(MSVC)
    target_compile_options(benchmark_engine PRIVATE /fp:precise)
endif()
target_compile_definitions(benchmark_engine PRIVATE
    BLUE_ENGINE_USE_PERFORMANCE_TRACKING=1
    BLUE_ENGINE_SOURCE_REVISION="${BLUE_ENGINE_SOURCE_REVISION}"
)
if(UNIX AND NOT APPLE)
    target_link_libraries(benchmark_engine PRIVATE dl)
    target_link_options(benchmark_engine PRIVATE -static-libgcc -static-libstdc++)
endif()

# Platform-specific dynamic loading library
if(UNIX AND NOT APPLE)
    target_link_libraries(blue-engine PRIVATE dl)
    # Keep the C++ runtime inside the sidecar; glibc and the system loader
    # remain the only Linux ABI baseline dependencies.
    target_link_options(blue-engine PRIVATE -static-libgcc -static-libstdc++)
endif()

# =============================================================================
# CTest - Unit Tests
# =============================================================================
enable_testing()

# Unit tests
add_subdirectory(tests/cpp)

# Example clients (optional)
option(BUILD_EXAMPLES "Build example clients" OFF)
if(BUILD_EXAMPLES)
    add_subdirectory(examples/c)
    add_subdirectory(examples/cpp)
endif()

# Test 1: Executable runs and shows help
add_test(
    NAME blue-engine-help
    COMMAND blue-engine --help
)
set_tests_properties(blue-engine-help PROPERTIES
    PASS_REGULAR_EXPRESSION "Usage:.*blue-engine"
    TIMEOUT 10
)

# Test 2: Invalid option returns error
add_test(
    NAME blue-engine-invalid-option
    COMMAND blue-engine --invalid-option
)
set_tests_properties(blue-engine-invalid-option PROPERTIES
    WILL_FAIL TRUE
    TIMEOUT 10
)

# Install
install(TARGETS blue-engine RUNTIME DESTINATION bin)

# =============================================================================
# CPack Configuration - Native Installer Generation
# =============================================================================

set(CPACK_PACKAGE_NAME "blue-engine")
set(CPACK_PACKAGE_VENDOR "Steven Yi")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Blue audio engine wrapping Csound with ZeroMQ control")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_VERSION_MAJOR "${PROJECT_VERSION_MAJOR}")
set(CPACK_PACKAGE_VERSION_MINOR "${PROJECT_VERSION_MINOR}")
set(CPACK_PACKAGE_VERSION_PATCH "${PROJECT_VERSION_PATCH}")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "blue-engine")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_SOURCE_DIR}/LICENSE.txt")

# Architecture suffix for package names
if(CMAKE_SYSTEM_PROCESSOR MATCHES "arm64|aarch64")
    set(CPACK_SYSTEM_NAME "${CMAKE_SYSTEM_NAME}-arm64")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    set(CPACK_SYSTEM_NAME "${CMAKE_SYSTEM_NAME}-x64")
else()
    set(CPACK_SYSTEM_NAME "${CMAKE_SYSTEM_NAME}-${CMAKE_SYSTEM_PROCESSOR}")
endif()

# Platform-specific generator configuration
if(APPLE)
    set(CPACK_GENERATOR "productbuild")
    set(CPACK_PRODUCTBUILD_IDENTIFIER "com.kunstmusik.blue-engine")
elseif(WIN32)
    # Prefer WIX, fall back to NSIS
    find_program(WIX_FOUND candle)
    if(WIX_FOUND)
        set(CPACK_GENERATOR "WIX")
        set(CPACK_WIX_UPGRADE_GUID "A1B2C3D4-E5F6-7890-ABCD-EF1234567890")
        set(CPACK_WIX_PRODUCT_ICON "${CMAKE_SOURCE_DIR}/resources/icon.ico")
    else()
        set(CPACK_GENERATOR "NSIS")
        set(CPACK_NSIS_DISPLAY_NAME "blue-engine")
        set(CPACK_NSIS_PACKAGE_NAME "blue-engine")
        set(CPACK_NSIS_MODIFY_PATH ON)
    endif()
else()
    # Linux - create tarball for manual installation
    set(CPACK_GENERATOR "TGZ")
endif()

include(CPack)
