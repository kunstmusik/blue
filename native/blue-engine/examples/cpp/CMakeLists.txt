# C++ example client

add_executable(example_client_cpp test_client.cpp)

# Prefer target-based ZMQ usage (Windows/vcpkg); fall back to legacy vars for pkg-config
if(ZMQ_USE_TARGET)
    target_link_libraries(example_client_cpp PRIVATE ${ZMQ_TARGET})
    target_include_directories(example_client_cpp PRIVATE
        ${CMAKE_SOURCE_DIR}/src
        $<TARGET_PROPERTY:${ZMQ_TARGET},INTERFACE_INCLUDE_DIRECTORIES>
    )
else()
    target_include_directories(example_client_cpp PRIVATE
        ${CMAKE_SOURCE_DIR}/src
        ${ZMQ_INCLUDE_DIRS}
    )
    target_link_libraries(example_client_cpp PRIVATE
        ${ZMQ_LINK_LIBRARIES}
    )
    target_link_directories(example_client_cpp PRIVATE
        ${ZMQ_LIBRARY_DIRS}
    )
endif()

set_target_properties(example_client_cpp PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
