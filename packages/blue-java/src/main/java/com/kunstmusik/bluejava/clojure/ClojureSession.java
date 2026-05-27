package com.kunstmusik.bluejava.clojure;

import com.kunstmusik.bluejava.errors.ClojureEvaluationException;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

public final class ClojureSession {
    private final ClojureEngine engine;

    public ClojureSession(String namespace) {
        this.engine = new ClojureEngine(namespace);
    }

    public String getNamespace() {
        return engine.getNamespace();
    }

    public String eval(String code, Map<String, ? extends Object> bindings, String returnVariableName) {
        try {
            if (bindings != null) {
                engine.intern(bindings);
            }

            Object returnValue = engine.eval(code);
            String text = returnValue != null ? returnValue.toString() : "";

            if (returnVariableName != null) {
                Object value = engine.eval("(str " + returnVariableName + ")");
                if (value != null) {
                    text = value.toString();
                }
            }

            return text;
        } catch (RuntimeException ex) {
            throw toEvaluationException(ex);
        }
    }

    public String evaluateScoreObject(String code, double blueDuration, String projectDir) {
        Map<String, Object> bindings = new HashMap<>();
        bindings.put("score", "");
        bindings.put("blueDuration", blueDuration);
        bindings.put("blueProjectDir", projectDir != null ? new File(projectDir) : null);
        return eval(code, bindings, "score");
    }

    private ClojureEvaluationException toEvaluationException(RuntimeException ex) {
        if (ex instanceof ClojureEvaluationException evaluationException) {
            return evaluationException;
        }

        if (ex instanceof ClojureEngineException engineException) {
            Throwable cause = engineException.getCause() != null ? engineException.getCause() : engineException;
            return new ClojureEvaluationException(
                    cause.getMessage() != null ? cause.getMessage() : "Unable to evaluate Clojure code",
                    cause,
                    engineException.line,
                    engineException.column);
        }

        Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
        return new ClojureEvaluationException(
                cause.getMessage() != null ? cause.getMessage() : "Unable to evaluate Clojure code",
                cause,
                null,
                null);
    }
}