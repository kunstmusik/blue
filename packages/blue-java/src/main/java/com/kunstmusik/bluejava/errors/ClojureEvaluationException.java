package com.kunstmusik.bluejava.errors;

public final class ClojureEvaluationException extends RuntimeException {
    private final Integer line;
    private final Integer column;
    private final String stdout;
    private final String stderr;

    public ClojureEvaluationException(String message, Throwable cause, Integer line, Integer column) {
        this(message, cause, line, column, "", "");
    }

    public ClojureEvaluationException(
            String message,
            Throwable cause,
            Integer line,
            Integer column,
            String stdout,
            String stderr
    ) {
        super(message, cause);
        this.line = line;
        this.column = column;
        this.stdout = stdout != null ? stdout : "";
        this.stderr = stderr != null ? stderr : "";
    }

    public Integer getLine() {
        return line;
    }

    public Integer getColumn() {
        return column;
    }

    public String getStdout() {
        return stdout;
    }

    public String getStderr() {
        return stderr;
    }
}
