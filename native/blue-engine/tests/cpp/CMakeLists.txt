# Unit tests for CTest

# FixedPoint unit tests (header-only, no linking needed)
add_executable(test_fixedpoint test_fixedpoint.cpp)
target_include_directories(test_fixedpoint PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_fixedpoint PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME FixedPointTests COMMAND test_fixedpoint)

# Quantization tests (tests the quantization logic used in AutomationManager)
add_executable(test_automation_fixedpoint
    test_automation_fixedpoint.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
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

add_executable(test_csound_runtime_services
    test_csound_runtime_services.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundRuntimeServices.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
)
target_include_directories(test_csound_runtime_services PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_csound_runtime_services PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_csound_runtime_services PRIVATE dl)
endif()
add_test(NAME CsoundRuntimeServicesTests COMMAND test_csound_runtime_services)

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
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundRuntimeServices.cpp
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

# Lifecycle stress target used by AddressSanitizer/ThreadSanitizer runs. The
# default CTest invocation keeps it short; the documented stress command
# passes --duration-seconds 600 for the full soak.
add_executable(test_csound_stress
    test_csound_stress.cpp
    ${CMAKE_SOURCE_DIR}/src/engine/CsoundEngine.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/SharedMemory.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_csound_stress PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_csound_stress PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_csound_stress PRIVATE dl)
endif()
option(ENABLE_SANITIZERS "Enable ASan/UBSan for native stress targets" OFF)
option(ENABLE_TSAN "Enable ThreadSanitizer for native stress targets" OFF)
if(ENABLE_SANITIZERS)
    target_compile_options(test_csound_stress PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
    target_link_options(test_csound_stress PRIVATE -fsanitize=address,undefined)
endif()
if(ENABLE_TSAN)
    target_compile_options(test_csound_stress PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
    target_link_options(test_csound_stress PRIVATE -fsanitize=thread)
endif()
add_test(NAME CsoundLifecycleStress COMMAND test_csound_stress --duration-seconds 2)
set_tests_properties(CsoundLifecycleStress PROPERTIES
    LABELS "stress;requires-csound"
    SKIP_RETURN_CODE 77
    TIMEOUT 30
)

# Control-plane idle behavior does not require Csound or a bound TCP port.
add_executable(test_zmq_idle_wakeup
    test_zmq_idle_wakeup.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/ZmqHandler.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/SharedMemory.cpp
    ${CMAKE_SOURCE_DIR}/src/engine/CsoundEngine.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
    ${CMAKE_SOURCE_DIR}/src/protocol/Capabilities.cpp
)
target_include_directories(test_zmq_idle_wakeup PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_zmq_idle_wakeup PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
target_link_libraries(test_zmq_idle_wakeup PRIVATE libzmq-static)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_zmq_idle_wakeup PRIVATE dl)
endif()
add_test(NAME ZmqIdleWakeupTests COMMAND test_zmq_idle_wakeup)
