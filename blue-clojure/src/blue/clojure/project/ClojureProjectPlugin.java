/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.clojure.project;

import blue.BlueData;
import blue.clojure.BlueClojureEngine;
import blue.plugin.ProjectPluginItem;
import blue.project.ProjectPlugin;
import blue.project.ProjectPluginUtils;
import javax.script.ScriptException;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
@ProjectPluginItem(position = 10)
public class ClojureProjectPlugin implements ProjectPlugin {

    @Override
    public void preRender(BlueData data) {
        ClojureProjectData pluginData = ProjectPluginUtils.findPluginData(
                data.getPluginData(),
                ClojureProjectData.class);

        if (pluginData != null) {

            String libraryString = pluginData.getPomegranateString();

            if (libraryString != null) {
                try {
                    BlueClojureEngine.getInstance().processScript(
                            libraryString, null, null);
                } catch (ScriptException ex) {
                    Exceptions.printStackTrace(ex);
                    throw new RuntimeException(
                            "Could not load Clojure library dependencies", ex);
                }
            }
        }
    }

}
