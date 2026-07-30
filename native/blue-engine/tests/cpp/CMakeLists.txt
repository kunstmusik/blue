# Unit tests for CTest

# FixedPoint unit tests (header-only, no linking needed)
add_executable(test_fixedpoint test_fixedpoint.cpp)
target_include_directories(test_fixedpoint PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_fixedpoint PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME FixedPointTests COMMAND test_fixedpoint)

# Quantization tests (tests the quantization logic used in AutomationManager)
add_executable(test_automation_fixedpoint test_automation_fixedpoint.cpp)
target_include_directories(test_automation_fixedpoint PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_automation_fixedpoint PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME QuantizationTests COMMAND test_automation_fixedpoint)

# AutomationStore tests
add_executable(test_automation_fixedpoint_simple
    test_automation_fixedpoint_simple.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
)
target_include_directories(test_automation_fixedpoint_simple PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_automation_fixedpoint_simple PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME AutomationStoreTests COMMAND test_automation_fixedpoint_simple)

# AutomationManager state invalidation tests
add_executable(test_automation_manager
    test_automation_manager.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_automation_manager PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_automation_manager PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME AutomationManagerTests COMMAND test_automation_manager)

# Csound loader/probe tests do not require an installed Csound library.
add_executable(test_csound_probe
    test_csound_probe.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/protocol/Capabilities.cpp
)
target_include_directories(test_csound_probe PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_csound_probe PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_csound_probe PRIVATE dl)
endif()
add_test(NAME CsoundProbeTests COMMAND test_csound_probe)

add_executable(test_engine_capabilities
    test_engine_capabilities.cpp
    ${CMAKE_SOURCE_DIR}/src/protocol/Capabilities.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
)
target_include_directories(test_engine_capabilities PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_engine_capabilities PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_engine_capabilities PRIVATE dl)
endif()
add_test(NAME EngineCapabilitiesTests COMMAND test_engine_capabilities)

# Native channel bridge integration test
add_executable(test_channel_bridge
    test_channel_bridge.cpp
    ${CMAKE_SOURCE_DIR}/src/engine/CsoundEngine.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/SharedMemory.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_channel_bridge PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_channel_bridge PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_channel_bridge PRIVATE dl)
endif()
add_test(NAME ChannelBridgeTests COMMAND test_channel_bridge)
set_tests_properties(ChannelBridgeTests PROPERTIES
    LABELS "integration;requires-csound"
    SKIP_RETURN_CODE 77
)

add_executable(test_csound_integration
    test_csound_integration.cpp
    ${CMAKE_SOURCE_DIR}/src/engine/CsoundEngine.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/SharedMemory.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_csound_integration PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_csound_integration PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_csound_integration PRIVATE dl)
endif()
add_test(NAME CsoundIntegrationTests COMMAND test_csound_integration)
set_tests_properties(CsoundIntegrationTests PROPERTIES
    LABELS "integration;requires-csound"
    SKIP_RETURN_CODE 77
)
