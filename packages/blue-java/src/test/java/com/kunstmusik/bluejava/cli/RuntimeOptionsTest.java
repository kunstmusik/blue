package com.kunstmusik.bluejava.cli;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuntimeOptionsTest {
    @Test
    void parsesEndpointsAndToken() {
        RuntimeOptions options = RuntimeOptions.parse(new String[]{
                "--control-endpoint", "tcp://127.0.0.1:5555",
                "--event-endpoint", "tcp://127.0.0.1:5556",
                "--auth-token", "secret"
        });

        assertEquals("tcp://127.0.0.1:5555", options.getControlEndpoint());
        assertEquals("tcp://127.0.0.1:5556", options.getEventEndpoint());
        assertEquals("secret", options.getAuthToken());
    }

    @Test
    void acceptsHelpWithoutEndpoints() {
        RuntimeOptions options = RuntimeOptions.parse(new String[]{"--help"});

        assertTrue(options.isHelp());
        assertNull(options.getControlEndpoint());
        assertNull(options.getAuthToken());
    }

    @Test
    void rejectsMissingRequiredOptions() {
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> RuntimeOptions.parse(new String[]{"--control-endpoint", "tcp://127.0.0.1:5555"})
        );

        assertTrue(error.getMessage().contains("--auth-token"));
    }
}