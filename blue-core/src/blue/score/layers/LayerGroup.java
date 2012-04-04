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

import blue.SoundObjectLibrary;
import electric.xml.Element;

/**
 *
 * @author stevenyi
 */
public interface LayerGroup {
    
    /**
     * Returns an XML Representation of this object.
     * 
     * @param sObjLibrary
     * @return 
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary);

    /**
     * Adds a new Layer at specified index.
     * 
     * @param index 
     */
    public Layer newLayerAt(int index);
    
    /**
     * Removes Layer from startIndex to endIndex.
     * 
     * @param startIndex
     * @param endindex 
     */
    public void removeLayers(int startIndex, int endindex);
    
    /**
     * Push up Layers from startIndex to endIndex.
     * @param startIndex
     * @param endIndex 
     */
    public void pushUpLayers(int startIndex, int endIndex);
    
    /**
     * Push down Layers from startIndex to endIndex.
     * 
     * @param startIndex
     * @param endIndex 
     */
    public void pushDownLayers(int startIndex, int endIndex);

    /**
     * Returns number of Layers in LayerGroup
     * @return 
     */
    public int getSize();
    
    /**
     * Returns Layer at index.
     * 
     * @param index
     * @return 
     */
    public Layer getLayerAt(int index);

    /* LISTENER CODE */
    
    /**
     * Add a LayerGroupListener to this LayerGroup.
     */
    public void addLayerGroupListener(LayerGroupListener listener);
    
    /**
     * Remove a LayerGroupListener to this LayerGroup.
     */
    public void removeLayerGroupListener(LayerGroupListener listener);
}
