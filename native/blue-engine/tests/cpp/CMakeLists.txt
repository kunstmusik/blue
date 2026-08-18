# Unit tests for CTest

# All test targets that include the production automation evaluator must use
# the same Java-order floating-point controls as the engine target. Applying
# the options at directory scope is intentional: CMake may compile the same
# AutomationManager.cpp source independently for each test target, so a
# source-file property from the parent directory is not sufficient here.
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    add_compile_options(-ffp-contract=off -fno-associative-math)
elseif(MSVC)
    add_compile_options(/fp:precise)
endif()

# Exact-decimal arithmetic tests (Boost.Multiprecision behind private modules,
# hard-fail upstream allocator, allocation-contract instrumentation).
add_executable(test_java_bigdecimal
    test_java_bigdecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
)
target_include_directories(test_java_bigdecimal PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_java_bigdecimal PRIVATE Boost::boost)
set_target_properties(test_java_bigdecimal PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME JavaBigDecimalTests COMMAND test_java_bigdecimal)

# Java parity fixture corpus consumers: exact output bits for the production
# evaluators plus the shared TSV reader. The canonical corpus is copied into
# the build tree by the root CMakeLists and its path injected here; tests never
# keep an independent expected-result copy.
add_executable(test_java_bigdecimal_parity
    test_java_bigdecimal_parity.cpp
    java_parity_fixtures.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_java_bigdecimal_parity PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_java_bigdecimal_parity PRIVATE Boost::boost)
target_compile_definitions(test_java_bigdecimal_parity PRIVATE
    BLUE_ENGINE_PARITY_FIXTURES_DIR="${BLUE_ENGINE_PARITY_FIXTURES_DIR}"
    BLUE_ENGINE_TESTING=1)
set_target_properties(test_java_bigdecimal_parity PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME JavaBigDecimalParityTests COMMAND test_java_bigdecimal_parity)

# Automation protocol v2 payload parsing through the ZMQ handler boundary.
add_executable(test_automation_protocol
    test_automation_protocol.cpp
    java_parity_fixtures.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/ZmqHandler.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/SharedMemory.cpp
    ${CMAKE_SOURCE_DIR}/src/engine/CsoundEngine.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
    ${CMAKE_SOURCE_DIR}/src/protocol/Capabilities.cpp
)
target_include_directories(test_automation_protocol PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_automation_protocol PRIVATE libzmq-static Boost::boost)
target_compile_definitions(test_automation_protocol PRIVATE
    BLUE_ENGINE_PARITY_FIXTURES_DIR="${BLUE_ENGINE_PARITY_FIXTURES_DIR}")
set_target_properties(test_automation_protocol PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_automation_protocol PRIVATE dl)
endif()
add_test(NAME AutomationProtocolTests COMMAND test_automation_protocol)

# The former FixedPoint/quantization fixtures and their duplicated native
# expectation tables were replaced by the canonical corpus consumers above
# (test_java_bigdecimal, test_java_bigdecimal_parity) per Spec 073.

# AutomationManager state invalidation tests
add_executable(test_automation_manager
    test_automation_manager.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_automation_manager PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_automation_manager PRIVATE Boost::boost)
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
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_channel_bridge PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_channel_bridge PRIVATE Boost::boost)
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
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_csound_integration PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_csound_integration PRIVATE Boost::boost)
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
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
)
target_include_directories(test_csound_stress PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_csound_stress PRIVATE Boost::boost)
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
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
    ${CMAKE_SOURCE_DIR}/src/protocol/Capabilities.cpp
)
target_include_directories(test_zmq_idle_wakeup PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_zmq_idle_wakeup PRIVATE Boost::boost)
set_target_properties(test_zmq_idle_wakeup PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
target_link_libraries(test_zmq_idle_wakeup PRIVATE libzmq-static)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_zmq_idle_wakeup PRIVATE dl)
endif()
add_test(NAME ZmqIdleWakeupTests COMMAND test_zmq_idle_wakeup)

# Owner lifetime monitor unit tests
add_executable(test_owner_monitor
    test_owner_monitor.cpp
    ${CMAKE_SOURCE_DIR}/src/process/OwnerMonitor.cpp
)
target_include_directories(test_owner_monitor PRIVATE ${CMAKE_SOURCE_DIR}/src .)
set_target_properties(test_owner_monitor PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_owner_monitor PRIVATE pthread)
endif()
add_test(NAME OwnerMonitorTests COMMAND test_owner_monitor)

# Concurrent independent endpoint binding test
add_executable(test_engine_concurrency
    test_engine_concurrency.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/ZmqHandler.cpp
    ${CMAKE_SOURCE_DIR}/src/ipc/SharedMemory.cpp
    ${CMAKE_SOURCE_DIR}/src/engine/CsoundEngine.cpp
    ${CMAKE_SOURCE_DIR}/src/csound/CsoundLoader.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationStore.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/JavaBigDecimal.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/ExactDecimalQuantizer.cpp
    ${CMAKE_SOURCE_DIR}/src/automation/AutomationManager.cpp
    ${CMAKE_SOURCE_DIR}/src/protocol/Capabilities.cpp
)
target_include_directories(test_engine_concurrency PRIVATE ${CMAKE_SOURCE_DIR}/src)
target_link_libraries(test_engine_concurrency PRIVATE Boost::boost libzmq-static)
set_target_properties(test_engine_concurrency PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_engine_concurrency PRIVATE dl pthread)
endif()
add_test(NAME EngineConcurrencyTests COMMAND test_engine_concurrency)

# Short-lived owner termination integration test
add_executable(test_owner_monitor_integration
    test_owner_monitor_integration.cpp
    ${CMAKE_SOURCE_DIR}/src/process/OwnerMonitor.cpp
)
target_include_directories(test_owner_monitor_integration PRIVATE ${CMAKE_SOURCE_DIR}/src .)
set_target_properties(test_owner_monitor_integration PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
if(UNIX AND NOT APPLE)
    target_link_libraries(test_owner_monitor_integration PRIVATE pthread)
endif()
add_test(NAME OwnerMonitorIntegrationTests COMMAND test_owner_monitor_integration)
