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
package blue.project;

import blue.BlueDataObject;
import electric.xml.Element;
import java.util.List;

/**
 *
 * @author stevenyi
 */
public class ProjectPluginUtils {

    public static Element getBaseElement(Class<?> pluginDataClass) {
        Element retVal = new Element("blueDataObject");
        retVal.setAttribute("bdoType", pluginDataClass.getName());

        return retVal;
    }

    public static <T> T findPluginData(List<BlueDataObject> pluginData, Class<T> type) {
        for (BlueDataObject bdoObj : pluginData) {
            if (bdoObj.getClass().equals(type)) {
                return (T) bdoObj;
            }
        }
        return null;
    }
}
