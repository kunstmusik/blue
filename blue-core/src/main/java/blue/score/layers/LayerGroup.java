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

import blue.CompileData;
import blue.noteProcessor.NoteProcessorChain;
import blue.score.ScoreGenerationException;
import blue.soundObject.NoteList;
import electric.xml.Element;
import java.util.List;
import java.util.Map;

/**
 *
 * @author stevenyi
 */
public interface LayerGroup<T extends Layer> extends List<T>, 
        DeepCopyableLG<LayerGroup<T>> {
    
    String getName();
    
    void setName(String name);
    
    /**
     * Get NoteProcessorChain for this LayerGroup. 
     * 
     * @return 
     */
    NoteProcessorChain getNoteProcessorChain();
    
    /**
     * Returns if solo layers are found in this group.  Score will use this to
     * determine if soloing should be considered when rendering the complete 
     * score.
     * 
     * @return 
     */
    boolean hasSoloLayers();
    
    /** 
     * Called when compiling a CSD.  LayerGroups should use CompileData to add
     * things besides score values, and should return score data as NoteLists.
     * They can use the compileMap to store temporary data during the 
     * compilation phase.
     * 
     * @param compileData 
     */
    NoteList generateForCSD(CompileData compileData, double startTime, double endTime, boolean processWithSolo) throws ScoreGenerationException;
    
    /**
     * Returns an XML Representation of this object.
     * 
     * @param sObjLibrary
     * @return 
     */
    Element saveAsXML(Map<Object, String> objRefMap);

    /**
     * Adds a new Layer at specified index.
     * 
     * @param index 
     */
    T newLayerAt(int index);
    
    /**
     * Removes Layer from startIndex to endIndex.
     * 
     * @param startIndex
     * @param endindex 
     */
    void removeLayers(int startIndex, int endindex);
    
    /**
     * Push up Layers from startIndex to endIndex.
     * @param startIndex
     * @param endIndex 
     */
    void pushUpLayers(int startIndex, int endIndex);
    
    /**
     * Push down Layers from startIndex to endIndex.
     * 
     * @param startIndex
     * @param endIndex 
     */
    void pushDownLayers(int startIndex, int endIndex);

    /* LIFECYCLE EVENT CODE */
    
    /** Called when a project has been loaded and allows layer to initialize
     * any values.
     */
    void onLoadComplete();

    /* LISTENER CODE */
    
    /**
     * Add a LayerGroupListener to this LayerGroup.
     */
    void addLayerGroupListener(LayerGroupListener listener);
    
    /**
     * Remove a LayerGroupListener to this LayerGroup.
     */
    void removeLayerGroupListener(LayerGroupListener listener);
}
