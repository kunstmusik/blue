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
package blue.score.layers;

import electric.xml.Element;
import java.util.Map;

/**
 * Factory class that creates new LayerGroups as well as loads them from XML.
 * 
 * @author stevenyi
 */
public interface LayerGroupProvider {
    
    /**
     * Returns the name of the LayerGroup. 
     * 
     * @return the name of the LayerGroup (i.e. "SoundObject", "Pattern")
     */
    public String getLayerGroupName();
    
    /**
     * Creates a new LayerGroup
     * 
     * @return 
     */
    LayerGroup createLayerGroup();
    
    /**
     * Loads a new LayerGroup from XML.  Currently takes in SoundObjectLibrary
     * to match PolyObject's design, but this needs to be revisited as not all
     * LayerGroups will use the SoundObject abstraction.
     * 
     * @return 
     */
    LayerGroup loadFromXML(Element element, Map<String, Object> objRefMap);
}
