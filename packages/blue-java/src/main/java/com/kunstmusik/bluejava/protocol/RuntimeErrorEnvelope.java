package com.kunstmusik.bluejava.protocol;

import java.util.Map;

public final class RuntimeErrorEnvelope {
    public String code;
    public String message;
    public Map<String, Object> details;
    public String stack;
    public Integer line;
    public Integer column;

    public RuntimeErrorEnvelope() {
    }

    public RuntimeErrorEnvelope(String code, String message) {
        this.code = code;
        this.message = message;
    }
}