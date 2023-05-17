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
import blue.BlueSystem;
import javax.script.ScriptContext;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import javax.script.SimpleScriptContext;
import org.netbeans.api.scripting.Scripting;

public class JavaScriptProxy {

    private static ScriptEngine engine;

    static {

    }

    public static synchronized final void reinitialize() {
//        if (cx != null) {
//            Context.exit();
//        }
//        cx = Context.enter();
//        scope = cx.initStandardObjects(null);
//        engine = new ScriptEngineManager().getEngineByName("graal.js");
        engine = Scripting.createManager().getEngineByMimeType("text/javascript");
        engine.getContext().setAttribute(ScriptEngine.FILENAME, "script.mjs", ScriptContext.ENGINE_SCOPE);
//        Context.newBuilder("js").allowIO(true).currentWorkingDirectory(workingDirectory)
        System.out.println(BlueSystem.getString("scripting.js.reinitialized"));
    }

    public static synchronized final String processJavascriptScore(String script,
            double subjectiveDuration, String soundObjectId) throws ScriptException {
        if (engine == null) {
            reinitialize();
        }
        
        
        String returnScore = "";

        String init = "blueDuration = " + subjectiveDuration
                + ";\n";
        init += "score = '';";
        
        
//        engine.setBindings(bindings, ScriptContext.GLOBAL_SCOPE);
        //engine.setContext(context);
        
        engine.eval(init);
        engine.eval(script);

//        cx.evaluateString(scope, init, "init", 1, null);
//        cx.evaluateString(scope, script, soundObjectId, 1, null);
        var res = engine.get("score");

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
        if (engine == null) {
            reinitialize();
        }
        String returnInstrument = "";

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
        engine.eval(init);
        engine.eval(script);
        var res = engine.get("instrument");
        return res == null ? (String) res : res.toString();

    }

}
