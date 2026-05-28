package com.kunstmusik.bluejava.clojure;

import clojure.java.api.Clojure;
import clojure.lang.DynamicClassLoader;
import clojure.lang.IFn;
import clojure.lang.IPersistentMap;
import clojure.lang.LineNumberingPushbackReader;
import clojure.lang.RT;
import clojure.lang.Symbol;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.Writer;
import java.util.Map;

public final class ClojureEngine {
    private static final IFn EVAL_FN = Clojure.var("clojure.core", "eval");
    private static final IFn READ_FN = Clojure.var("clojure.core", "read");
    private static final IFn IN_NS = Clojure.var("clojure.core", "in-ns");
    private static final IFn REFER = Clojure.var("clojure.core", "refer");
    private static final IFn INTERN = Clojure.var("clojure.core", "intern");
    private static final Object CURRENT_NS_SYM = Clojure.read("*ns*");
    private static final Object OUT_VAR = Clojure.var("clojure.core", "*out*");
    private static final Object ERR_VAR = Clojure.var("clojure.core", "*err*");
    private static final IFn PUSH_THREAD_BINDINGS = Clojure.var("clojure.core", "push-thread-bindings");
    private static final IFn POP_THREAD_BINDINGS = Clojure.var("clojure.core", "pop-thread-bindings");
    private static final Object EOF = new Object();

    private final Object userNs;
    private final IPersistentMap bindings;
    private final DynamicClassLoader classLoader;

    public ClojureEngine(String namespace) {
        ClassLoader previousClassLoader = Thread.currentThread().getContextClassLoader();
        classLoader = new DynamicClassLoader(previousClassLoader);
        Thread.currentThread().setContextClassLoader(classLoader);

        bindings = RT.map(
                Clojure.var("clojure.core", "*ns*"),
                EVAL_FN.invoke(CURRENT_NS_SYM),
                clojure.lang.Compiler.LOADER,
                classLoader,
                Clojure.var("clojure.core", "*compile-path*"),
                "classes"
        );

        PUSH_THREAD_BINDINGS.invoke(bindings);
        try {
            userNs = Clojure.read(namespace);
            IN_NS.invoke(userNs);
            REFER.invoke(Clojure.read("clojure.core"));
        } finally {
            POP_THREAD_BINDINGS.invoke();
            Thread.currentThread().setContextClassLoader(previousClassLoader);
        }
    }

    public String getNamespace() {
        return userNs.toString();
    }

    public Object eval(String code) {
        return eval(code, null, null);
    }

    public Object eval(String code, Writer stdout, Writer stderr) {
        ClassLoader previousClassLoader = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(classLoader);
        PrintWriter stdoutWriter = stdout != null ? new PrintWriter(stdout) : null;
        PrintWriter stderrWriter = stderr != null ? new PrintWriter(stderr) : null;
        IPersistentMap activeBindings = bindings;
        if (stdoutWriter != null) {
            activeBindings = activeBindings.assoc(OUT_VAR, stdoutWriter);
        }
        if (stderrWriter != null) {
            activeBindings = activeBindings.assoc(ERR_VAR, stderrWriter);
        }

        PUSH_THREAD_BINDINGS.invoke(activeBindings);
        IN_NS.invoke(userNs);

        LineNumberingPushbackReader reader = new LineNumberingPushbackReader(new StringReader(code));
        Object result = null;

        try {
            Object form;
            while ((form = READ_FN.invoke(reader, false, EOF)) != null && form != EOF) {
                result = EVAL_FN.invoke(form);
            }
        } catch (RuntimeException ex) {
            throw new ClojureEngineException(ex, reader.getLineNumber(), reader.getColumnNumber());
        } finally {
            try {
                reader.close();
            } catch (IOException ignored) {
            }

            if (stdoutWriter != null) {
                stdoutWriter.flush();
            }
            if (stderrWriter != null) {
                stderrWriter.flush();
            }
            POP_THREAD_BINDINGS.invoke();
            Thread.currentThread().setContextClassLoader(previousClassLoader);
        }

        return result;
    }

    public void intern(Map<String, ? extends Object> values) {
        ClassLoader previousClassLoader = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(classLoader);
        PUSH_THREAD_BINDINGS.invoke(bindings);
        IN_NS.invoke(userNs);

        try {
            if (values == null) {
                return;
            }

            for (Map.Entry<String, ? extends Object> entry : values.entrySet()) {
                INTERN.invoke(userNs, Symbol.create(entry.getKey()), entry.getValue());
            }
        } finally {
            POP_THREAD_BINDINGS.invoke();
            Thread.currentThread().setContextClassLoader(previousClassLoader);
        }
    }
}
