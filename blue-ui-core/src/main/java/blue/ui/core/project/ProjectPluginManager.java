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
package blue.ui.core.project;

import blue.BlueData;
import blue.project.ProjectPlugin;
import java.util.Collection;
import org.openide.util.lookup.Lookups;

/**
 *
 * @author stevenyi
 */
public class ProjectPluginManager {
     
    private static ProjectPluginManager INSTANCE = null;

    public static ProjectPluginManager getInstance() {
        if(INSTANCE == null) {
            INSTANCE = new ProjectPluginManager();
        }
        return INSTANCE;
    }
    
    private ProjectPluginManager() {}

    public void preRender(BlueData data) {
        Collection<? extends ProjectPlugin> plugins = 
                Lookups.forPath("blue/project/plugins").lookupAll(ProjectPlugin.class);
        for(ProjectPlugin plugin : plugins) {
            plugin.preRender(data);
        }
    }
}
