/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package com.kunstmusik.clojureengine;

/**
 *
 * @author stevenyi
 */
public class ClojureEngineException extends RuntimeException {
    public final int line;
    public final int column;

    public ClojureEngineException(Throwable cause, int line, int column)  {
        super(cause);
        this.line = line;
        this.column = column;
    }


}
