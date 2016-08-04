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
import com.kunstmusik.clojureengine.ClojureEngine;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.script.ScriptException;

/**
 *
 * @author stevenyi
 */
public class BlueClojureEngine implements PropertyChangeListener {

    private static AtomicInteger NS_COUNTER = new AtomicInteger(0);

    private static class LazyHolder {

        private static final BlueClojureEngine INSTANCE;

        static {
            INSTANCE = new BlueClojureEngine();
            BlueProjectManager.getInstance().addPropertyChangeListener(INSTANCE);
            INSTANCE.currentProject = BlueProjectManager.getInstance().getCurrentProject();
        }
    }

    private BlueProject currentProject = null;
    private HashMap<BlueProject, ClojureEngine> engines
            = new HashMap<>();

    public static BlueClojureEngine getInstance() {
        return LazyHolder.INSTANCE;
    }

    public void reinitialize() {
        if (currentProject == null) {
            return;
        }

        File f = BlueSystem.getCurrentProjectDirectory();
        File projScriptDir = null;
        File userScriptDir = new File(BlueSystem.getUserScriptDir()
                + File.separator + "clojure");

        if (f != null) {
            projScriptDir = new File(
                    f.getAbsolutePath() + File.separator + "script"
                    + File.separator + "clojure");
        }

        ClojureEngine engine = new ClojureEngine("user" + NS_COUNTER.getAndIncrement(), userScriptDir, projScriptDir);

        engines.put(currentProject,
                engine);

    }

    public String processScript(String code,
            HashMap<String, ? extends Object> values,
            String returnVariableName) throws ScriptException {

        if (engines.get(currentProject) == null) {
            reinitialize();
        }

        ClojureEngine engine = engines.get(currentProject);

        String retVal = "";

        if (values != null) {
            engine.intern(values);
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
                if (engines.containsKey(this.currentProject)) {
                    engines.remove(this.currentProject);
                }
            }

            this.currentProject = (BlueProject) evt.getNewValue();
        }
    }
}
