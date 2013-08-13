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

package blue.plugin;

import java.util.ArrayList;

/**
 *
 * @author syi
 */
public class DefaultBluePluginProvider implements BluePluginProvider {
    ArrayList<BluePlugin> plugins = new ArrayList<BluePlugin>();

    public void addPlugin(BluePlugin plugin) {
        plugins.add(plugin);
    }

    @Override
    public ArrayList<BluePlugin> getPlugins(Class pluginType) {
        ArrayList<BluePlugin> returnValue = new ArrayList<BluePlugin>();

        for(BluePlugin plugin : plugins) {
            if(plugin.getPluginType() == pluginType) {
                returnValue.add(plugin);
            }
        }

        return returnValue;
    }

    @Override
    public ArrayList<Class> getPluginClasses(Class pluginType) {
        ArrayList<Class> pluginClasses = new ArrayList<Class>();

        for(BluePlugin plugin : plugins) {
            if(plugin.getPluginType() == pluginType) {
                pluginClasses.add(plugin.getPluginClass());
            }
        }
        return pluginClasses;
    }
    
//    public ArrayList<Class> getLiveSoundObjectClasses() {
//        ArrayList<Class> sObjects = new ArrayList<Class>();
//
//        for (BluePlugin plugin : plugins) {
//            if(plugin.getPluginType() == SoundObject.class &&
//                    Boolean.TRUE.equals(
//                    plugin.getProperty(BluePlugin.PROP_LIVE))) {
//                sObjects.add(plugin.getPluginClass());
//            }
//        }
//
//        return sObjects;
//    }
//
//    public ArrayList<Class> getSoundObjectClasses() {
//        return getPluginClasses(SoundObject.class);
//    }
//
//    public ArrayList<Class> getNoteProcessorClasses() {
//        return getPluginClasses(NoteProcessor.class);
//    }
//
//    public ArrayList<Class> getInstrumentClasses() {
//        return getPluginClasses(Instrument.class);
//    }
}
