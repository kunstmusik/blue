# C example client
add_executable(example_client_c test_client.c)

# Prefer target-based ZMQ usage (Windows/vcpkg); fall back to legacy vars for pkg-config
if(ZMQ_USE_TARGET)
    target_link_libraries(example_client_c PRIVATE ${ZMQ_TARGET})
    target_include_directories(example_client_c PRIVATE
        $<TARGET_PROPERTY:${ZMQ_TARGET},INTERFACE_INCLUDE_DIRECTORIES>
    )
else()
    target_include_directories(example_client_c PRIVATE
        ${ZMQ_INCLUDE_DIRS}
    )
    target_link_libraries(example_client_c PRIVATE
        ${ZMQ_LINK_LIBRARIES}
    )
    target_link_directories(example_client_c PRIVATE
        ${ZMQ_LIBRARY_DIRS}
    )
endif()
