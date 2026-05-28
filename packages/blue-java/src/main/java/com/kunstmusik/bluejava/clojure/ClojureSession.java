package com.kunstmusik.bluejava.clojure;

import com.kunstmusik.bluejava.errors.ClojureEvaluationException;

import java.io.File;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

public final class ClojureSession {
    private static final Pattern SAFE_RETURN_VARIABLE = Pattern.compile("[A-Za-z_*!?+\\-][A-Za-z0-9_*!?+\\-]*");
    private final ClojureEngine engine;

    public ClojureSession(String namespace) {
        this.engine = new ClojureEngine(namespace);
    }

    public String getNamespace() {
        return engine.getNamespace();
    }

    public String eval(String code, Map<String, ? extends Object> bindings, String returnVariableName) {
        return evalWithOutput(code, bindings, returnVariableName).value();
    }

    public ClojureEvaluationResult evalWithOutput(
            String code,
            Map<String, ? extends Object> bindings,
            String returnVariableName
    ) {
        StringWriter stdout = new StringWriter();
        StringWriter stderr = new StringWriter();

        try {
            if (bindings != null) {
                engine.intern(bindings);
            }

            Object returnValue = engine.eval(code, stdout, stderr);
            String text = returnValue != null ? returnValue.toString() : "";

            if (returnVariableName != null) {
                if (!SAFE_RETURN_VARIABLE.matcher(returnVariableName).matches()) {
                    throw new IllegalArgumentException("Invalid Clojure return variable: " + returnVariableName);
                }
                Object value = engine.eval("(str " + returnVariableName + ")", stdout, stderr);
                if (value != null) {
                    text = value.toString();
                }
            }

            return new ClojureEvaluationResult(text, stdout.toString(), stderr.toString());
        } catch (RuntimeException ex) {
            throw toEvaluationException(ex, stdout.toString(), stderr.toString());
        }
    }

    public String evaluateScoreObject(String code, double blueDuration, String projectDir) {
        return evaluateScoreObjectWithOutput(code, blueDuration, projectDir).value();
    }

    public ClojureEvaluationResult evaluateScoreObjectWithOutput(String code, double blueDuration, String projectDir) {
        Map<String, Object> bindings = new HashMap<>();
        bindings.put("score", "");
        bindings.put("blueDuration", blueDuration);
        bindings.put("blueProjectDir", projectDir != null ? new File(projectDir) : null);
        return evalWithOutput(code, bindings, "score");
    }

    private ClojureEvaluationException toEvaluationException(RuntimeException ex, String stdout, String stderr) {
        if (ex instanceof ClojureEvaluationException evaluationException) {
            return evaluationException;
        }

        if (ex instanceof ClojureEngineException engineException) {
            Throwable cause = engineException.getCause() != null ? engineException.getCause() : engineException;
            return new ClojureEvaluationException(
                    cause.getMessage() != null ? cause.getMessage() : "Unable to evaluate Clojure code",
                    cause,
                    engineException.line,
                    engineException.column,
                    stdout,
                    stderr);
        }

        Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
        return new ClojureEvaluationException(
                cause.getMessage() != null ? cause.getMessage() : "Unable to evaluate Clojure code",
                cause,
                null,
                null,
                stdout,
                stderr);
    }

    public record ClojureEvaluationResult(String value, String stdout, String stderr) {
    }
}
