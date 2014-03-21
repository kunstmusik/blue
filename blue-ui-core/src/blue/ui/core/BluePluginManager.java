/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.ui.core;

import blue.plugin.BluePlugin;
import blue.plugin.BluePluginProvider;
import blue.soundObject.SoundObject;
import java.util.ArrayList;
import org.openide.util.Lookup;
import org.openide.util.lookup.Lookups;

/**
 *
 * @author syi
 */
public class BluePluginManager {

    private static BluePluginManager instance = new BluePluginManager();

    private BluePluginManager() {
       
    }

    public static BluePluginManager getInstance() {
        return instance;
    }

  
    public ArrayList<BluePlugin> getPlugins(Class pluginType) {
        ArrayList<BluePlugin> returnValue = new ArrayList<>();

        Lookup lkp = Lookups.forPath("blue/pluginProviders");
    
        for(BluePluginProvider provider : lkp.lookupAll(BluePluginProvider.class)) {
            returnValue.addAll(provider.getPlugins(pluginType));
        }

        return returnValue;
    }

    protected ArrayList<Class> getPluginClasses(Class pluginType) {
        
        ArrayList<Class> pluginClasses = new ArrayList<>();

        for(BluePlugin plugin : getPlugins(pluginType) ) {
            
            pluginClasses.add(plugin.getPluginClass());
            
        }
        return pluginClasses;
    }
    
    public ArrayList<Class> getLiveSoundObjectClasses() {
        ArrayList<Class> sObjects = new ArrayList<>();

        for (BluePlugin plugin : getPlugins(SoundObject.class)) {
            if(Boolean.TRUE.equals(
                    plugin.getProperty(BluePlugin.PROP_LIVE))) {
                sObjects.add(plugin.getPluginClass());
            }
        }

        return sObjects;
    }

    public ArrayList<Class> getSoundObjectClasses() {
        return getPluginClasses(SoundObject.class);
    }
}
