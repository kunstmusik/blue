/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package com.kunstmusik.clojureengine;

import clojure.java.api.Clojure;
import clojure.lang.DynamicClassLoader;
import clojure.lang.IFn;
import clojure.lang.LineNumberingPushbackReader;
import clojure.lang.RT;
import clojure.lang.Symbol;
import java.io.File;
import java.io.IOException;
import java.io.StringReader;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Map;

/**
 *
 * @author stevenyi
 */
public class ClojureEngine {

    private static final IFn EVAL_FN = Clojure.var("clojure.core", "eval");
    private static final IFn READ_FN = Clojure.var("clojure.core", "read");
    private static final IFn ASSOC = Clojure.var("clojure.core", "assoc");
    private static final IFn IN_NS = Clojure.var("clojure.core", "in-ns");
    private static final IFn REFER = Clojure.var("clojure.core", "refer");
    private static final IFn INTERN = Clojure.var("clojure.core", "intern");
    private static final Object CURRENT_NS_SYM = Clojure.read("*ns*");
    private static final IFn PUSH_THREAD_BINDINGS = Clojure.var("clojure.core",
            "push-thread-bindings");
    private static final IFn POP_THREAD_BINDINGS = Clojure.var("clojure.core",
            "pop-thread-bindings");
    private static final Object EOF = new Object();

    private final Object userNs;
    private Object bindings;
    DynamicClassLoader cl;

    public ClojureEngine(String namespace, File blueUserScriptDir,
            File blueProjectScriptDir) {
        ClassLoader old = Thread.currentThread().getContextClassLoader();
//        ClassLoader origin = Clojure.class.getClassLoader();
//        Thread.currentThread().setContextClassLoader(origin);

        cl = new DynamicClassLoader(old);

//        if (blueUserScriptDir != null && blueUserScriptDir.exists()) {
//            try {
//                URL url = blueUserScriptDir.toURI().toURL();
//                cl.addURL(url);
//            } catch (MalformedURLException ex) {
//                throw new RuntimeException(ex);
//            }
//        }
//
//        if (blueProjectScriptDir != null && blueProjectScriptDir.exists()) {
//            try {
//                URL url = blueProjectScriptDir.toURI().toURL();
//                cl.addURL(url);
//            } catch (MalformedURLException ex) {
//                throw new RuntimeException(ex);
//            }
//        }
        Thread.currentThread().setContextClassLoader(cl);
        bindings = RT.map(
                Clojure.var("clojure.core", "*ns*"),
                EVAL_FN.invoke(CURRENT_NS_SYM),
                clojure.lang.Compiler.LOADER,
                cl,
                Clojure.var("clojure.core", "*compile-path*"),
                "classes"
        );
                
//                EVAL_FN.invoke(Clojure.read("{}"));
//        bindings = ASSOC.invoke(bindings,
//                Clojure.var("clojure.core", "*ns*"),
//                EVAL_FN.invoke(CURRENT_NS_SYM));
//        bindings = ASSOC.invoke(bindings,
//                clojure.lang.Compiler.LOADER,
//                cl);

        PUSH_THREAD_BINDINGS.invoke(bindings);
        userNs = Clojure.read(namespace);
        IN_NS.invoke(userNs);
        REFER.invoke(Clojure.read("clojure.core"));
//        System.out.println("NS: " + EVAL_FN.invoke(CURRENT_NS_SYM));
        POP_THREAD_BINDINGS.invoke();
        Thread.currentThread().setContextClassLoader(old);
        // may need to track current namespace
    }

    public Object eval(String code) {
        ClassLoader old = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(cl);
        PUSH_THREAD_BINDINGS.invoke(bindings);
        IN_NS.invoke(userNs);

        LineNumberingPushbackReader reader = new LineNumberingPushbackReader(
                new StringReader(code));
        Object obj;
        Object res = null;

        try {
            while ((obj = READ_FN.invoke(reader, false, EOF)) != null
                    && obj != EOF) {
                res = EVAL_FN.invoke(obj);
//                System.out.println(res);
            }
        } catch (RuntimeException e) {
            throw new ClojureEngineException(e, reader.getLineNumber(),
                    reader.getColumnNumber());
        } finally {
            try {
                reader.close();
            } catch (IOException ioe) {
                // swallow exception 
            }
            POP_THREAD_BINDINGS.invoke();
            Thread.currentThread().setContextClassLoader(old);
        }

        return res;
    }

    public void intern(Map<String, ? extends Object> values) {
        ClassLoader old = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(cl);

        PUSH_THREAD_BINDINGS.invoke(bindings);
        IN_NS.invoke(userNs);

        try {
            if (values != null) {
                for (String key : values.keySet()) {
                    INTERN.invoke(userNs, Symbol.create(key), values.get(key));
                }
            }
        } finally {
            POP_THREAD_BINDINGS.invoke();
            Thread.currentThread().setContextClassLoader(old);
        }
    }
}
