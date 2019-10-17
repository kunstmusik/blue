/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.soundObject;

import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupProvider;
import electric.xml.Element;
import java.util.Map;
import java.util.function.Supplier;

/**
 *
 * @author stevenyi
 */
public class PolyObjectLayerGroupProvider implements LayerGroupProvider {

    private static Supplier<Integer> defaultHeightIndexProvider = null;

    public static void setDefaultHeightIndexProvider(Supplier<Integer> supplier) {
        defaultHeightIndexProvider = supplier;
    }

    @Override
    public String getLayerGroupName() {
        return "SoundObject";
    }

    @Override
    public LayerGroup createLayerGroup() {
        PolyObject pObj = new PolyObject(true);
        pObj.newLayerAt(0);
        pObj.setName("SoundObject Layer Group");

        if (defaultHeightIndexProvider != null) {
            pObj.setDefaultHeightIndex(defaultHeightIndexProvider.get());
        }
        return pObj;
    }

    @Override
    public LayerGroup loadFromXML(Element element, Map<String, Object> objRefMap) {
        if ("soundObject".equals(element.getName())) {
            String type = element.getAttributeValue("type");
            if (type != null && type.equals("blue.soundObject.PolyObject")) {
                try {
                    return PolyObject.loadFromXML(element, objRefMap);
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            }
        }
        return null;
    }

}
