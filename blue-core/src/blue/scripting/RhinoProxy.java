package blue.scripting;

/**
 * <p>Title: blue</p>
 * <p>Description: an object composition environment for csound</p>
 * <p>Copyright: Copyright (c) 2001-2002</p>
 * <p>Company: steven yi music</p>
 * @author unascribed
 * @version 1.0
 */

import org.mozilla.javascript.Context;
import org.mozilla.javascript.JavaScriptException;
import org.mozilla.javascript.Scriptable;

import blue.BlueSystem;

public class RhinoProxy {
    private static Context cx;

    private static Scriptable scope;

    static {

    }

    public static final void reinitialize() {
        if (cx != null) {
            Context.exit();
        }
        cx = Context.enter();
        scope = cx.initStandardObjects(null);
        System.out.println(BlueSystem.getString("scripting.js.reinitialized"));
    }

    public static final String processJavascriptScore(String script,
            float subjectiveDuration, String soundObjectId) {
        if (cx == null) {
            reinitialize();
        }
        String returnScore = "";

        String init = "blueDuration = " + Float.toString(subjectiveDuration)
                + ";\n";
        init += "score = '';";

        try {
            cx.evaluateString(scope, init, "init", 1, null);
            cx.evaluateString(scope, script, soundObjectId, 1, null);

            Object obj = scope.get("score", scope);
            if (obj != Scriptable.NOT_FOUND) {
                returnScore = Context.toString(obj);
            }
        } catch (JavaScriptException e) {
            System.out.println(e.getLocalizedMessage());
        }

        return returnScore;
    }

    public static final String processJavascriptInstrument(String script,
            String instrumentId) {
        if (cx == null) {
            reinitialize();
        }
        String returnInstrument = "";

        String init = "instrument = '';\n";

        try {
            cx.evaluateString(scope, init, "init", 1, null);
            cx.evaluateString(scope, script, instrumentId, 1, null);

            Object obj = scope.get("instrument", scope);
            if (obj != Scriptable.NOT_FOUND) {
                returnInstrument = Context.toString(obj);
            }
        } catch (JavaScriptException e) {
            System.out.println(e.getLocalizedMessage());
        }

        return returnInstrument;
    }

    /*
     * private static final String getRhinoLibPath() { String home =
     * blue.BlueSystem.getHomeDir(); String sep =
     * System.getProperty("file.separator"); System.out.println("Python Library
     * Directory set to: " + home + sep + "lib" + sep + "pythonLib"); return
     * (home + sep + "lib" + sep + "pythonLib"); return ""; }
     */

    public static void main(String[] args) {
        String script = "function f(num) {\n";
        script += "  returnText = '';\n";
        script += "for(var i = 0; i < num; i++) {\n";
        script += "returnText += 'i1 ' + i + ' 1 2 3 4 5\\n';\n";
        script += "}\n";
        script += "return returnText;\n";
        script += "}\n";
        script += "score = f(4);";
        script += "score += f(5);";
        System.out.println(RhinoProxy.processJavascriptScore(script, 0.0f,
                "unit test 1"));

        System.out.println(RhinoProxy.processJavascriptScore(
                "score += '\\nhi\\n'", 0.0f, "unit test 2"));
        RhinoProxy.reinitialize();

        System.out.println(RhinoProxy.processJavascriptScore(
                "score += '\\nhi\\n'", 0.0f, "unit test 3"));

    }
}