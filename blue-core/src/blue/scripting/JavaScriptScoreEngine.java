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

import java.util.Map;
import javax.script.ScriptException;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author stevenyi
 */
@ServiceProvider(service = ScoreScriptEngine.class)
public class JavaScriptScoreEngine implements ScoreScriptEngine {

    @Override
    public String getEngineName() {
        return "JavaScript";
    }

    @Override
    public String evalCode(String code, Map<String, Object> initValues) throws ScriptException {
        return JavaScriptProxy.processJavascriptScore(code,
                (Double) initValues.get("blueDuration"), null);
    }

}
