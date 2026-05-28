package com.kunstmusik.bluejava.jython;

public final class JythonEvaluationException extends RuntimeException {
    private final String code;
    private final Integer line;
    private final Integer column;
    private final String stdout;
    private final String stderr;

    public JythonEvaluationException(
            String code,
            String message,
            Throwable cause,
            Integer line,
            Integer column,
            String stdout,
            String stderr
    ) {
        super(message, cause);
        this.code = code;
        this.line = line;
        this.column = column;
        this.stdout = stdout != null ? stdout : "";
        this.stderr = stderr != null ? stderr : "";
    }

    public String getCode() {
        return code;
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