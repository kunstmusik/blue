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

import blue.SoundObjectLibrary;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupProvider;
import electric.xml.Element;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class PolyObjectLayerGroupProvider implements LayerGroupProvider {

    @Override
    public String getLayerGroupName() {
        return "SoundObject";
    }

    @Override
    public LayerGroup createLayerGroup() {
        PolyObject pObj = new PolyObject(true);
        pObj.newLayerAt(0);
        return pObj;
    }

    @Override
    public LayerGroup loadFromXML(Element element, SoundObjectLibrary sObjLibrary) {
        if ("soundObject".equals(element.getName())) {
            String type = element.getAttributeValue("type");
            if(type != null && type.equals("blue.soundObject.PolyObject")) {
                try {
                    return PolyObject.loadFromXML(element, sObjLibrary);
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            }
        }
        return null;
    }
    
}
