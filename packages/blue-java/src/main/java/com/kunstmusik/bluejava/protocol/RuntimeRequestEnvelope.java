package com.kunstmusik.bluejava.protocol;

import com.fasterxml.jackson.databind.JsonNode;

public final class RuntimeRequestEnvelope {
    public String id;
    public String method;
    public String authToken;
    public JsonNode params;
}