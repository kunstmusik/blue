package com.kunstmusik.bluejava.protocol;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProtocolEnvelopeTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesAndParsesRequestEnvelope() throws Exception {
        RuntimeRequestEnvelope request = new RuntimeRequestEnvelope();
        request.id = "req-1";
        request.method = RuntimeMethod.RUNTIME_HEALTH.getValue();
        request.authToken = "secret";
        request.params = objectMapper.valueToTree(Map.of());

        String json = objectMapper.writeValueAsString(request);
        JsonNode node = objectMapper.readTree(json);

        assertEquals("req-1", node.get("id").asText());
        assertEquals("runtime.health", node.get("method").asText());
        assertEquals("secret", node.get("authToken").asText());
    }

    @Test
    void serializesJythonMethodRequestEnvelope() throws Exception {
        RuntimeRequestEnvelope request = new RuntimeRequestEnvelope();
        request.id = "req-jython";
        request.method = RuntimeMethod.JYTHON_IMPORT_CHECK.getValue();
        request.authToken = "secret";
        request.params = objectMapper.valueToTree(Map.of("modules", new String[]{"orchestra", "pmask"}));

        String json = objectMapper.writeValueAsString(request);
        JsonNode node = objectMapper.readTree(json);

        assertEquals("req-jython", node.get("id").asText());
        assertEquals("jython.importCheck", node.get("method").asText());
        assertEquals(2, node.get("params").get("modules").size());
    }

    @Test
    void serializesSuccessResponse() throws Exception {
        RuntimeResponseEnvelope<Map<String, Object>> response = RuntimeResponseEnvelope.success(
                "req-2",
                Map.of("accepted", true),
                12L);

        String json = objectMapper.writeValueAsString(response);
        JsonNode node = objectMapper.readTree(json);

        assertEquals("req-2", node.get("id").asText());
        assertTrue(node.get("ok").asBoolean());
        assertTrue(node.get("result").get("accepted").asBoolean());
        assertEquals(12L, node.get("elapsedMs").asLong());
    }

    @Test
    void serializesErrorResponse() throws Exception {
        RuntimeResponseEnvelope<Object> response = RuntimeResponseEnvelope.error(
                "req-3",
                new RuntimeErrorEnvelope("PROTOCOL_ERROR", "Bad request"),
                7L);

        String json = objectMapper.writeValueAsString(response);
        JsonNode node = objectMapper.readTree(json);

        assertFalse(node.get("ok").asBoolean());
        assertEquals("PROTOCOL_ERROR", node.get("error").get("code").asText());
        assertEquals("Bad request", node.get("error").get("message").asText());
    }
}