package com.kunstmusik.bluejava.protocol;

public enum RuntimeMethod {
    RUNTIME_HEALTH("runtime.health"),
    SESSION_INIT("session.init"),
    CLOJURE_EVAL("clojure.eval"),
    CLOJURE_EVAL_SCORE_OBJECT("clojure.evalScoreObject"),
    CLOJURE_REINITIALIZE("clojure.reinitialize"),
    RUNTIME_SHUTDOWN("runtime.shutdown");

    private final String value;

    RuntimeMethod(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static RuntimeMethod fromValue(String value) {
        for (RuntimeMethod method : values()) {
            if (method.value.equals(value)) {
                return method;
            }
        }
        throw new IllegalArgumentException("Unknown runtime method: " + value);
    }
}