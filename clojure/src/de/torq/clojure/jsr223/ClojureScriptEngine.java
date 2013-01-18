package de.torq.clojure.jsr223;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.io.PrintWriter;
import java.io.Reader;
import java.io.StringReader;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;

import javax.script.AbstractScriptEngine;
import javax.script.Bindings;
import javax.script.Invocable;
import javax.script.ScriptContext;
import javax.script.ScriptEngineFactory;
import javax.script.ScriptException;

import clojure.lang.Associative;
import clojure.lang.Compiler;
import clojure.lang.IFn;
import clojure.lang.ISeq;
import clojure.lang.LineNumberingPushbackReader;
import clojure.lang.LispReader;
import clojure.lang.Namespace;
import clojure.lang.RT;
import clojure.lang.Symbol;
import clojure.lang.Var;

/**
 * The design of Clojure is somewhat special in that there is no way to get
 * some kind of context-object that serves as handle for a certain instance of
 * an engine; instead, clojure.lang.RT works by using thread-locals as handle.
 * This has the implication that we must manage internal handles to different
 * engines on a separate thread for each instance. In other words, the instance
 * of ClojureScriptEngine (which wraps RT) is a regular object, but internally
 * it has to communicate with a reference to RT on another thread. This is not
 * important to users of this class, I just felt a need to justify my rather
 * strange design.
 *
 * TODO:
 * - How to retrieve a map of current bindings? Use namespace-introspection?
 * - get("a") can probably be implemented by simply evaluating "a"
 * - What's best for set("a", (Object)a)? Use Var.find and Var.set?
 *
 */
public class ClojureScriptEngine extends AbstractScriptEngine
                                 implements Invocable
{

    private static final ScriptEngineFactory factory = new ClojureScriptEngineFactory();

    private final ExecutorService executor;

    private final Symbol instanceNS = Symbol.create("cse-" + Integer.toString(RT.nextID()));

    public final String namespaceSeparator = "/";

    // BEGIN From clojure.lang.Repl
    static final Symbol CLOJURE = Symbol.create(ClojureBindings.nsClojure);

    static final Var in_ns = RT.var(ClojureBindings.nsClojure, "in-ns");
    static final Var refer = RT.var(ClojureBindings.nsClojure, "refer");
    static final Var ns = RT.var(ClojureBindings.nsClojure, "*ns*");
    static final Var compile_path = RT.var(ClojureBindings.nsClojure, "*compile-path*");
    static final Var warn_on_reflection = RT.var(ClojureBindings.nsClojure, "*warn-on-reflection*");
    static final Var print_meta = RT.var(ClojureBindings.nsClojure, "*print-meta*");
    static final Var print_length = RT.var(ClojureBindings.nsClojure, "*print-length*");
    static final Var print_level = RT.var(ClojureBindings.nsClojure, "*print-level*");
    // END From clojure.lang.Repl

    private ClojureBindings engineBindings = new ClojureBindings();
    private static final Associative globalBindings = RT.map(
        ns, ns.get(),
        warn_on_reflection, warn_on_reflection.get(),
        print_meta, print_meta.get(),
        print_length, print_length.get(),
        print_level, print_level.get(),
        compile_path, "classes"
    );

    public ClojureScriptEngine()
        throws ScriptException
    {
        // TODO: use ScriptContext's engineScope/globalScope; store bindings
        // locally; push on stack before each invocation and pop off stack
        // after each invocation of a method
        //Var.pushThreadBindings();
        executor = Executors.newSingleThreadExecutor(
            new ClojureScriptEngineThreadFactory());
        submitAndGetResult(new CallableClojureInitialization(globalBindings, instanceNS));
        eval("(ns " + instanceNS.getName() + " (:refer-clojure))");
    }

    /**
     * Submit the given callable to our executor and block until we have the
     * result.
     */
    private Object submitAndGetResult(Callable<Object> c)
        throws ScriptException
    {
        Future<Object> f = executor.submit(c);

        try
        {
            return f.get();
        }
        catch (InterruptedException e)
        {
            throw new RuntimeException(e);
        }
        catch (ExecutionException e)
        {
            throw new ScriptException(e);
        }
    }

    @Override
    public ScriptEngineFactory getFactory()
    {
        return factory;
    }

    @Override
    public Bindings createBindings()
    {
        return new ClojureBindings();
    }

    @Override
    public Object eval(Reader reader, ScriptContext context)
        throws ScriptException
    {
        CallableEval c = new CallableEval(reader, context, instanceNS);

        try
        {
            return submitAndGetResult(c);
        }
        catch (Exception e)
        {
            throw new ScriptException(e);
        }
    }

    @Override
    public Object eval(String script, ScriptContext context)
        throws ScriptException
    {
        //System.out.println("entering: eval(String script, ScriptContext context)");
        Object result = eval(new StringReader(script), context);
        //System.out.println("leaving: eval(String script, ScriptContext context)");
        return result;
    }

    @Override // required by Invocable-interface
    public <T> T getInterface(Class<T> clasz)
    {
        return null;
    }

    @Override // required by Invocable-interface
    public <T> T getInterface(Object thiz, Class<T> clasz)
    {
        return null;
    }

    @Override // required by Invocable-interface
    public Object invokeFunction(String name, Object... args)
        throws ScriptException
    {
        CallableClojureInvokeFunction c =
            new CallableClojureInvokeFunction(instanceNS, name, args);

        try
        {
            return submitAndGetResult(c);
        }
        catch (Exception e)
        {
            throw new ScriptException(e);
        }
    }

    @Override // required by Invocable-interface
    public Object invokeMethod(Object thiz, String name, Object... args)
        throws ScriptException
    {
        CallableClojureInvokeMethod c =
            new CallableClojureInvokeMethod(instanceNS, thiz, name, args);

        try
        {
            return submitAndGetResult(c);
        }
        catch (Exception e)
        {
            throw new ScriptException(e);
        }
    }

    /**
     * Create an ISeq from an array of objects.
     */
    public static ISeq makeSeqFromArray(Object[] array)
        throws ScriptException
    {
        try
        {
            return (ISeq)RT.var("clojure.core", "seq").invoke(array);
        }
        catch (Exception e)
        {
            throw new RuntimeException(e);
        }
    }
}


class CallableClojureInitialization implements Callable<Object>
{
    private final Associative bindings;
    private final Symbol ns;

    public CallableClojureInitialization(Associative bindings, Symbol ns)
    {
        this.bindings = bindings;
        this.ns = ns;
    }

    public Object call()
    {
        try
        {
            Var.pushThreadBindings(bindings);
            ClojureScriptEngine.in_ns.invoke(ns);
            ClojureScriptEngine.refer.invoke(ClojureScriptEngine.CLOJURE);

            return null;
        }
        catch (Exception e )
        {
            throw new RuntimeException(e);
        }
    }

}

class CallableClojureFinalization implements Callable<Object>
{
    public CallableClojureFinalization()
    {
    }

    public Object call()
    {
        Var.popThreadBindings();
        return null;
    }
}

class CallableEval implements Callable<Object>
{
    private final Reader reader;
    private final ScriptContext context;
    private final Symbol ns;

    public CallableEval(Reader reader, ScriptContext context, Symbol ns)
    {
        this.reader = reader;
        this.context = context;
        this.ns = ns;
    }

    public Object call()
    {
        return handleInput(ClojureBindings.toAssociative(context.getBindings(ScriptContext.ENGINE_SCOPE), ns));
    }

    private Object handleInput(Associative a)
    {
        Object result = null;
        try
        {
            Var.pushThreadBindings(a);

            //repl IO support
            LineNumberingPushbackReader rdr = new LineNumberingPushbackReader(reader);
            Writer w = context.getWriter();
            Object EOF = new Object();

            //start the loop
            for(; ;)
            {
                try
                {
                    Object r = LispReader.read(rdr, false, EOF, false);
                    if(r == EOF)
                    {
                        w.flush();
                        break;
                    }
                    Object ret = Compiler.eval(r);
                    result = ret;
                }
                catch(Throwable e)
                {
                    Throwable c = e;
                    while(c.getCause() != null)
                    {
                        c = c.getCause();
                    }
                    ScriptException scriptException = new ScriptException("Some exception in Clojure RT");
                    scriptException.initCause(e instanceof Compiler.CompilerException ? e : c);
                    throw scriptException;
                }
            }
        }
        catch (Exception e)
        {
            throw new RuntimeException(e);
        }
        finally
        {
            Var.popThreadBindings();
        }

        return result;
    }
}

class CallableClojureInvokeFunction implements Callable<Object>
{
    private final Symbol ns;
    private final String name;
    private final Object[] args;

    public CallableClojureInvokeFunction(Symbol ns, String name, Object... args)
    {
        this.ns = ns;
        this.name = name;
        this.args = args;
    }

    public Object call()
    {
        try
        {
            // We need to use Symbol.intern vs. Symbol.create because of
            // internal hasing going on within the Symbol-class.
            Symbol nameSym = Symbol.intern(ns.getName(), name);
            Var fnVar = (Var)Compiler.maybeResolveIn(Namespace.find(ns), nameSym);

            if (fnVar == null)
            {
                // We could not resolve the function within the current
                // namespace, so try a broader scope
                fnVar = (Var)Compiler.maybeResolveIn(Namespace.find(ns), Symbol.create(name.intern()));
            }

            if (fnVar == null)
            {
                throw new ScriptException("Function " + name + " cannot be resolved.");
            }

            if (args != null)
            {
                if (args.length > 0)
                {
                    return fnVar.applyTo(ClojureScriptEngine.makeSeqFromArray(args));
                }
                else
                {
                    return fnVar.invoke();
                }
            }
            else
            {
                return fnVar.invoke();
            }
        }
        catch (Exception e)
        {
            throw new RuntimeException(e);
        }
    }
}

class CallableClojureInvokeMethod implements Callable<Object>
{
    private static String MEMFN = "memfn".intern();
    private final Symbol ns;
    private final String name;
    private final Object thiz;
    private final Object[] args;

    public CallableClojureInvokeMethod(Symbol ns, Object thiz, String name, Object... args)
    {
        this.ns = ns;
        this.thiz = thiz;
        this.name = name;
        this.args = args;
    }

    public Object call()
    {
        try
        {
            Symbol nameSym = Symbol.intern(name.intern());

            // Prepend the name to the args
            Object[] name_plus_args = new Object[args.length + 1];
            name_plus_args[0] = nameSym;
            for (int i = 0; i < args.length; i++)
            {
                name_plus_args[i + 1] = args[i];
            }

            // The structure we need to build up has to look like this:
            // (. obj (nameOfMethod arg1 arg2))
            return Compiler.eval(
                ClojureScriptEngine.makeSeqFromArray(
                    new Object[]
                    {Symbol.intern(".".intern()),
                     thiz,
                     ClojureScriptEngine.makeSeqFromArray(name_plus_args)
                    }));

        }
        catch (Exception e)
        {
            throw new RuntimeException(e);
        }
    }
}

/**
 * Provides a ThreadFactory-implementation that returns daemon-threads (so
 * ClojureScriptEngines will not prevent the JVM from exiting).
 */
class ClojureScriptEngineThreadFactory implements ThreadFactory
{
    public Thread newThread(Runnable r)
    {
        Thread result = new Thread(r);
        result.setContextClassLoader(
            Thread.currentThread().getContextClassLoader());
        result.setDaemon(true);

        return result;

    }
}

