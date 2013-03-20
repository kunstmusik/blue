/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.clojure;

import blue.BlueSystem;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import clojure.lang.Symbol;
import clojure.lang.Var;
import de.torq.clojure.jsr223.ClojureScriptEngine;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.util.HashMap;
import javax.script.ScriptException;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BlueClojureEngine implements PropertyChangeListener {

    private static BlueClojureEngine instance = null;
    private BlueProject currentProject = null;
    private HashMap<BlueProject, ClojureScriptEngine> engines =
            new HashMap<BlueProject, ClojureScriptEngine>();

    public static BlueClojureEngine getInstance() {
        if (instance == null) {
            instance = new BlueClojureEngine();
            BlueProjectManager.getInstance().addPropertyChangeListener(instance);
            instance.currentProject = BlueProjectManager.getInstance().getCurrentProject();
        }
        return instance;
    }

    public void reinitialize() {
        try {
            if (currentProject == null) {
                return;
            }

            File f = BlueSystem.getCurrentProjectDirectory();
            File projScriptDir = null;

            if (f != null) {
                projScriptDir = new File(
                        f.getAbsolutePath() + File.separator + "script"
                        + File.separator + "clojure");
            }

            ClassLoader cl = new BlueClojureClassLoader(
                    new File(BlueSystem.getUserScriptDir()
                        + File.separator + "clojure"),
                    projScriptDir);

            ClojureScriptEngine engine = new ClojureScriptEngine(cl);

            engines.put(currentProject,
                    engine);
        } catch (ScriptException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public String processScript(String code,
            HashMap<String, ? extends Object> values,
            String returnVariableName) throws ScriptException {

        if (engines.get(currentProject) == null) {
            reinitialize();
        }
        
        ClojureScriptEngine engine = engines.get(currentProject);

        String retVal = "";

        if (values != null) {
            for (String key : values.keySet()) {
                Var.intern(engine.getInstanceNameSpace(), Symbol.create(key),
                        values.get(key));
            }
        }

        engine.eval(code);

        try {
            Object obj = engine.eval("(str score)");
            if (obj != null) {
                retVal = obj.toString();
            }
        } catch (Exception e) {
            e.printStackTrace();;
        }

        return retVal;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
            if (this.currentProject != null
                    && !BlueProjectManager.getInstance().isProjectStillOpen(this.currentProject)) {
                if(engines.containsKey(this.currentProject)) {
                    engines.remove(this.currentProject);
                }
            }

            this.currentProject = (BlueProject) evt.getNewValue();
        }
    }
}
