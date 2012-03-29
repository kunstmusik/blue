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

import java.util.HashMap;
import java.util.Map;

/**
 *
 * @author syi
 */
public class BluePlugin {

    public static final String PROP_LIVE = "live";
    public static final String PROP_EDIT_CLASS = "editClass";

    private Class pluginType;
    private Class pluginClass;
    Map<String, Object> properties = new HashMap<String, Object>();

    public BluePlugin(Class pluginType, Class pluginClass) {
        this(pluginType, pluginClass, null, null);
    }

    public BluePlugin(Class pluginType, Class pluginClass, String property, Object value) {
        this.pluginType = pluginType;
        this.pluginClass = pluginClass;

        if(property != null) {
            setProperty(property, value);
        }
    }

    /**
     * @return the pluginType
     */
    public Class getPluginType() {
        return pluginType;
    }

    /**
     * @param pluginType the pluginType to set
     */
    public void setPluginType(Class pluginType) {
        this.pluginType = pluginType;
    }

    /**
     * @return the pluginClass
     */
    public Class getPluginClass() {
        return pluginClass;
    }

    /**
     * @param pluginClass the pluginClass to set
     */
    public void setPluginClass(Class pluginClass) {
        this.pluginClass = pluginClass;
    }

    public Object getProperty(String propertyName) {
        return properties.get(propertyName);
    }

    public void setProperty(String propertyName, Object val)  {
        properties.put(propertyName, val);
    }
}
