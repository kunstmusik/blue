package com.kunstmusik.bluejava.errors;

public final class ClojureEvaluationException extends RuntimeException {
    private final Integer line;
    private final Integer column;

    public ClojureEvaluationException(String message, Throwable cause, Integer line, Integer column) {
        super(message, cause);
        this.line = line;
        this.column = column;
    }

    public Integer getLine() {
        return line;
    }

    public Integer getColumn() {
        return column;
    }
}