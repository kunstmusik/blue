package com.kunstmusik.bluejava.protocol;

public final class RuntimeResponseEnvelope<T> {
    public String id;
    public boolean ok;
    public T result;
    public RuntimeErrorEnvelope error;
    public String stdout = "";
    public String stderr = "";
    public long elapsedMs;

    public static <T> RuntimeResponseEnvelope<T> success(String id, T result, long elapsedMs) {
        RuntimeResponseEnvelope<T> response = new RuntimeResponseEnvelope<>();
        response.id = id;
        response.ok = true;
        response.result = result;
        response.elapsedMs = elapsedMs;
        return response;
    }

    public static RuntimeResponseEnvelope<Object> error(String id, RuntimeErrorEnvelope error, long elapsedMs) {
        RuntimeResponseEnvelope<Object> response = new RuntimeResponseEnvelope<>();
        response.id = id;
        response.ok = false;
        response.error = error;
        response.elapsedMs = elapsedMs;
        return response;
    }
}