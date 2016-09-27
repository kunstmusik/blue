package blue.scripting;

/**
 * <p>Title: blue</p>
 * <p>Description: an object composition environment for csound</p>
 * <p>Copyright: Copyright (c) 2001-2002</p>
 * <p>Company: steven yi music</p>
 * @author unascribed
 * @version 1.0
 */

import blue.BlueSystem;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

public class RhinoProxy {
    private static ScriptEngine engine = null;    
    
    static {

    }

    public static final void reinitialize() {
        ScriptEngineManager manager = new ScriptEngineManager();
        engine = manager.getEngineByName("JavaScript");
        System.out.println(BlueSystem.getString("scripting.js.reinitialized"));
    }

    public static final String processJavascriptScore(String script,
            double subjectiveDuration, String soundObjectId) {
        if (engine == null) {
            reinitialize();
        }
        String returnScore = "";

        String init = "blueDuration = " + Double.toString(subjectiveDuration)
                + ";\n";
        init += "score = '';";

        try {
            engine.eval(init);
            engine.eval(script);

            Object obj = engine.get("score");
            if (obj != null) {
                returnScore = obj.toString();
            }
        } catch (ScriptException e) {
            System.out.println(e.getLocalizedMessage());
        }

        return returnScore;
    }

    public static final String processJavascriptInstrument(String script,
            String instrumentId) {
        if (engine == null) {
            reinitialize();
        }
        String returnInstrument = "";

        String init = "instrument = '';\n";

        try {
            engine.eval(init);
            engine.eval(script);

            Object obj = engine.get("instrument");
            if (obj != null) {
                returnInstrument = obj.toString();
            }
        } catch (ScriptException e) {
            System.out.println(e.getLocalizedMessage());
        }

        return returnInstrument;
    }

}