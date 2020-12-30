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
import org.mozilla.javascript.Context;
import org.mozilla.javascript.JavaScriptException;
import org.mozilla.javascript.Scriptable;

public class JavaScriptProxy {

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
            double subjectiveDuration, String soundObjectId) throws JavaScriptException {
        if (cx == null) {
            reinitialize();
        }
        String returnScore = "";

        String init = "blueDuration = " + subjectiveDuration
                + ";\n";
        init += "score = '';";

        cx.evaluateString(scope, init, "init", 1, null);
        cx.evaluateString(scope, script, soundObjectId, 1, null);

        Object obj = scope.get("score", scope);
        if (obj != Scriptable.NOT_FOUND) {
            returnScore = Context.toString(obj);
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
            if (obj != null) {
                returnInstrument = obj.toString();
            }
        } catch (JavaScriptException e) {
            System.out.println(e.getLocalizedMessage());
        }

        return returnInstrument;
    }

}
