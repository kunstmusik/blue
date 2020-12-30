/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.scripting;

import java.util.HashMap;
import java.util.Map;
import java.util.ServiceLoader;

/**
 *
 * @author stevenyi
 */
public class ScoreScriptEngineManager {

    private static ScoreScriptEngineManager INSTANCE = null;

    private final Map<String, ScoreScriptEngine> engines;

    public static synchronized ScoreScriptEngineManager getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new ScoreScriptEngineManager();
        }
        return INSTANCE;
    }

    private ScoreScriptEngineManager() {
        engines = new HashMap<>();
        ServiceLoader<ScoreScriptEngine> loader = ServiceLoader.load(ScoreScriptEngine.class);
        for(ScoreScriptEngine eng : loader) {
            engines.put(eng.getEngineName(), eng);
        }
    }

    public ScoreScriptEngine getEngine(String name) {
        return engines.get(name);
    }
}
