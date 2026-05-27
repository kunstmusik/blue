package com.kunstmusik.bluejava.clojure;

public final class ClojureEngineException extends RuntimeException {
    public final int line;
    public final int column;

    public ClojureEngineException(Throwable cause, int line, int column) {
        super(cause);
        this.line = line;
        this.column = column;
    }
}