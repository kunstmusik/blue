package de.torq.clojure.jsr223;

import javax.script.ScriptException;
import javax.script.ScriptEngineFactory;
import javax.script.ScriptEngine;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class ClojureScriptEngineFactory implements ScriptEngineFactory
{
    private static final String engineName = "Clojure";

    private static final String engineVersion = "SVN HEAD";

    private static final String languageName = engineName;

    private static final String languageVersion = engineVersion;

    private static final List<String> fileExtensions = new ArrayList<String>()
    {{
        add("clj");
    }};

    private static final List<String> mimeTypes = new ArrayList<String>()
    {{
        add("text/plain");
    }};

    private static final List<String> nickNames = new ArrayList<String>()
    {{
        add("Clojure");
        add("clojure");
        add("clj");
    }};

    private static final Map<String, String> parameters = new HashMap<String, String>()
    {{
        put("ScriptEngine.ENGINE",           engineName);
        put("ScriptEngine.ENGINE_VERSION",   engineVersion);
        put("ScriptEngine.NAME",             engineName);
        put("ScriptEngine.LANGUAGE",         languageName);
        put("ScriptEngine.LANGUAGE_VERSION", languageVersion);
        put("THREADING",                     "MULTITHREADED");  // This could perhaps be "THREAD-ISOLATED", as Clojure's
                                                                // top-level vars are bound thread-locally.
    }};

    @Override
    public String getEngineName()
    {
        return engineName;
    }

    @Override
    public String getEngineVersion()
    {
        return engineVersion;
    }

    @Override
    public String getLanguageName()
    {
        return languageName;
    }

    @Override
    public String getLanguageVersion()
    {
        return languageVersion;
    }

    @Override
    public List<String> getExtensions()
    {
        return fileExtensions;
    }

    @Override
    public List<String> getMimeTypes()
    {
        return mimeTypes;
    }

    @Override
    public List<String> getNames()
    {
        return nickNames;
    }

    @Override
    public String getOutputStatement(String toDisplay)
    {
        return "(print \"" + toDisplay + "\")";
    }

    @Override
    public String getProgram(String... statements)
    {
        StringBuilder result = new StringBuilder("");

        for (int i = 0; i < statements.length; i++)
        {
            result.append(statements[i] + "\n");
        }

        return result.toString();
    }

    @Override
    public String getMethodCallSyntax(String obj, String m, String... args)
    {
        StringBuilder result = new StringBuilder("(." + m);
        result.append(" " + obj + " ");
        for (int i = 0; i < args.length; i++) {
            result.append(args[i]);
            if (i == args.length - 1) {
                result.append(")");
            } else {
                result.append(" ");
            }
        }

        return result.toString();
    }

    @Override
    public Object getParameter(String key)
    {
        // java.util.HashMap's get-method returns null when no mapping is
        // found, which is also the behaviour that getParameter's specification
        // wants, so we do not differentiate between null as
        // key-not-there-indicator and null as actual value of the key
        return parameters.get(key);
    }

    @Override
    public ScriptEngine getScriptEngine()
    {
        try
        {
            return new ClojureScriptEngine();
        }
        catch (ScriptException ex)
        {
            return null;
        }
    }

}

