/*
  * blue - object composition environment for csound
  *  Copyright (c) 2000-2009 Steven Yi (stevenyi@gmail.com)
  * 
  *  This program is free software; you can redistribute it and/or modify
  *  it under the terms of the GNU General Public License as published
  *  by  the Free Software Foundation; either version 2 of the License or
  *  (at your option) any later version.
  * 
  *  This program is distributed in the hope that it will be useful, but
  *  WITHOUT ANY WARRANTY; without even the implied warranty of
  *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  *  GNU General Public License for more details.
  * 
  *  You should have received a copy of the GNU General Public License
  *  along with this program; see the file COPYING.LIB.  If not, write to
  *  the Free Software Foundation Inc., 59 Temple Place - Suite 330,
  *  Boston, MA  02111-1307 USA
 */

package blue.ui.core.soundObject.renderer;

import blue.plugin.BluePlugin;
import blue.ui.core.BluePluginManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import org.openide.util.Exceptions;

/**
 *
 * @author steven
 */
public class BarRendererCache {
    private static BarRendererCache instance = null;

    private Map<Class, BarRenderer> barRenderers = new HashMap<>();

    private BarRendererCache() {}

    public static BarRendererCache getInstance() {
        if(instance == null) {
            instance = new BarRendererCache();
        }
        return instance;
    }

    public BarRenderer getBarRenderer(Class clazz) {

        BarRenderer renderer = barRenderers.get(clazz);

        if(renderer == null) {
            ArrayList<BluePlugin> plugins = BluePluginManager.getInstance().getPlugins(BarRenderer.class);

            for(BluePlugin plugin : plugins) {
                Class c = (Class) plugin.getProperty(BluePlugin.PROP_EDIT_CLASS);
                if(c.isAssignableFrom(clazz)) {
                    try {
                        renderer = (BarRenderer) plugin.getPluginClass().newInstance();
                        barRenderers.put(clazz, renderer);
                    } catch (            InstantiationException | IllegalAccessException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                }
            }
        }

        return renderer;
    }
}
