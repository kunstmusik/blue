package blue.scripting;

/**
 * <p>
 * Title: blue</p>
 * <p>
 * Description: an object composition environment for csound</p>
 * <p>
 * Copyright: Copyright (c) 2001-2002</p>
 * <p>
 * Company: steven yi music</p>
 *
 * @author unascribed
 * @version 1.0
 */
import blue.BlueData;
import blue.BlueSystem;
import java.io.File;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.util.ArrayList;
import java.util.Map;
import java.util.WeakHashMap;
import javax.script.ScriptContext;
import javax.script.ScriptEngine;
import javax.script.ScriptException;
import org.netbeans.api.scripting.Scripting;

public class JavaScriptProxy {

    private static final Map<BlueData, ProjectEngineState> projectEngineStates
        = new WeakHashMap<>();

    private static ProjectEngineState defaultEngineState;

    private static final ArrayList<JavaScriptProxyListener> listeners
            = new ArrayList<>();

    public static synchronized final void reinitialize() {
//        if (cx != null) {
//            Context.exit();
//        }
//        cx = Context.enter();
//        scope = cx.initStandardObjects(null);
//        engine = new ScriptEngineManager().getEngineByName("graal.js");
    ProjectEngineState state = createEngineState();
    BlueData currentData = BlueSystem.getCurrentBlueData();

    if (currentData == null) {
        defaultEngineState = state;
    } else {
        projectEngineStates.put(currentData, state);
    }

    ScriptContext context = state.engine.getContext();
        context.setAttribute(ScriptEngine.FILENAME, "script.mjs", ScriptContext.ENGINE_SCOPE);
//        Context.newBuilder("js").allowIO(true).currentWorkingDirectory(workingDirectory)
        System.out.println(BlueSystem.getString("scripting.js.reinitialized"));

        for (JavaScriptProxyListener listener : listeners) {
            listener.javascriptProxyReinitializePerformed();
        }
    }

    public static synchronized void addJavaScriptProxyListener(JavaScriptProxyListener listener) {
        listeners.add(listener);
    }

    public static synchronized void removeJavaScriptProxyListener(JavaScriptProxyListener listener) {
        listeners.remove(listener);
    }

    public static synchronized final String processJavascriptScore(String script,
            double subjectiveDuration, String soundObjectId) throws ScriptException {
        ScriptEngine scriptEngine = getCurrentEngineState().engine;
        setProjectBindings(scriptEngine);

        String init = "blueDuration = " + subjectiveDuration
                + ";\n";
        init += "score = '';";
        
        
//        engine.setBindings(bindings, ScriptContext.GLOBAL_SCOPE);
        //engine.setContext(context);
        
        scriptEngine.eval(init);
        scriptEngine.eval(script);

//        cx.evaluateString(scope, init, "init", 1, null);
//        cx.evaluateString(scope, script, soundObjectId, 1, null);
        var res = scriptEngine.get("score");

//        
//
//        Object obj = scope.get("score", scope);
//        if (obj != Scriptable.NOT_FOUND) {
//            returnScore = Context.toString(obj);
//        }
        return res.toString();
    }

    public static synchronized final String processJavascriptInstrument(String script,
            String instrumentId) throws ScriptException {
        ScriptEngine scriptEngine = getCurrentEngineState().engine;
        setProjectBindings(scriptEngine);
        String init = "instrument = '';\n";

//        try {
////            cx.evaluateString(scope, init, "init", 1, null);
////            cx.evaluateString(scope, script, instrumentId, 1, null);
//
//            engine.eval(init);
//            engine.eval(script);
//            
//            Object obj = scope.get("instrument", scope);
//            if (obj != null) {
//                returnInstrument = obj.toString();
//            }
//        } catch (JavaScriptException e) {
//            System.out.println(e.getLocalizedMessage());
//        }
        scriptEngine.eval(init);
        scriptEngine.eval(script);
        var res = scriptEngine.get("instrument");
        return java.util.Objects.toString(res, null);

    }

    public static synchronized Object processScript(String script, Reader stdin,
            Writer stdout, Writer stderr) throws ScriptException {
        ProjectEngineState state = getCurrentEngineState();
        ScriptEngine scriptEngine = state.engine;
        setProjectBindings(scriptEngine);
        state.consoleReader.setDelegate(stdin);
        state.consoleWriter.setDelegate(stdout);
        state.consoleErrorWriter.setDelegate(stderr);

        try {
            return scriptEngine.eval(script);
        } finally {
            state.consoleReader.clearDelegate();
            state.consoleWriter.clearDelegate();
            state.consoleErrorWriter.clearDelegate();
        }
    }

    private static ProjectEngineState getCurrentEngineState() {
        BlueData currentData = BlueSystem.getCurrentBlueData();

        if (currentData == null) {
            if (defaultEngineState == null) {
                defaultEngineState = createEngineState();
            }

            return defaultEngineState;
        }

        ProjectEngineState state = projectEngineStates.get(currentData);

        if (state == null) {
            state = createEngineState();
            projectEngineStates.put(currentData, state);
        }

        return state;
    }

    private static ProjectEngineState createEngineState() {
        ScriptEngine engine = Scripting.createManager().getEngineByMimeType("text/javascript");
        ProjectEngineState state = new ProjectEngineState(engine);
        installConsoleIo(state, engine.getContext());
        return state;
    }

    private static void installConsoleIo(ProjectEngineState state, ScriptContext context) {
        state.consoleReader.clearDelegate();
        state.consoleWriter.clearDelegate();
        state.consoleErrorWriter.clearDelegate();

        state.consoleReader.setFallback(context.getReader());
        state.consoleWriter.setFallback(context.getWriter());
        state.consoleErrorWriter.setFallback(context.getErrorWriter());

        context.setReader(state.consoleReader);
        context.setWriter(state.consoleWriter);
        context.setErrorWriter(state.consoleErrorWriter);
    }

    private static void setProjectBindings(ScriptEngine scriptEngine) {
        File currentDirFile = BlueSystem.getCurrentProjectDirectory();
        String currentDir = currentDirFile == null ? ""
                : currentDirFile.getAbsolutePath() + File.separator;

        scriptEngine.put("blueData", BlueSystem.getCurrentBlueData());
        scriptEngine.put("blueProjectDir", currentDir);
    }

    private static final class ProjectEngineState {

        private final ScriptEngine engine;

        private final DelegatingReader consoleReader = new DelegatingReader();

        private final DelegatingWriter consoleWriter = new DelegatingWriter();

        private final DelegatingWriter consoleErrorWriter = new DelegatingWriter();

        private ProjectEngineState(ScriptEngine engine) {
            this.engine = engine;
        }
    }

    private static final class DelegatingReader extends Reader {

        private Reader fallback;

        private Reader delegate;

        synchronized void setFallback(Reader fallback) {
            this.fallback = fallback;
        }

        synchronized void setDelegate(Reader delegate) {
            this.delegate = delegate;
        }

        synchronized void clearDelegate() {
            this.delegate = null;
        }

        private synchronized Reader current() {
            return delegate != null ? delegate : fallback;
        }

        @Override
        public int read(char[] cbuf, int off, int len) throws IOException {
            Reader reader = current();
            return reader == null ? -1 : reader.read(cbuf, off, len);
        }

        @Override
        public void close() {
        }
    }

    private static final class DelegatingWriter extends Writer {

        private Writer fallback;

        private Writer delegate;

        synchronized void setFallback(Writer fallback) {
            this.fallback = fallback;
        }

        synchronized void setDelegate(Writer delegate) {
            this.delegate = delegate;
        }

        synchronized void clearDelegate() {
            this.delegate = null;
        }

        private synchronized Writer current() {
            return delegate != null ? delegate : fallback;
        }

        @Override
        public void write(char[] cbuf, int off, int len) throws IOException {
            Writer writer = current();

            if (writer != null) {
                writer.write(cbuf, off, len);
            }
        }

        @Override
        public void flush() throws IOException {
            Writer writer = current();

            if (writer != null) {
                writer.flush();
            }
        }

        @Override
        public void close() throws IOException {
            flush();
        }
    }

}
