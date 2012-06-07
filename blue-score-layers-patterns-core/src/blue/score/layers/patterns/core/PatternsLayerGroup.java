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
package blue.score.layers.patterns.core;

import blue.CompileData;
import blue.SoundObjectLibrary;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.NoteList;
import blue.soundObject.OnLoadProcessable;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import electric.xml.Element;
import java.util.ArrayList;
import java.util.Vector;

/**
 *
 * @author stevenyi
 */
public class PatternsLayerGroup implements LayerGroup {

    private transient Vector<LayerGroupListener> layerGroupListeners = null;
    private ArrayList<PatternLayer> patternLayers = new ArrayList<PatternLayer>();

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) {
        throw new UnsupportedOperationException("Not supported yet.");
    }
    
    public static PatternsLayerGroup loadFromXML(Element data) {
        PatternsLayerGroup layerGroup = new PatternsLayerGroup();
        
        return layerGroup;
    }

    @Override
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element root = new Element("patternsLayerGroup");
        for(PatternLayer layer : patternLayers) {
            root.addElement(layer.saveAsXML());
        }
        return root;
    }

    @Override
    public Layer newLayerAt(int index) {
        
        PatternLayer patternLayer = new PatternLayer();
        
        if(index < 0 || index >= patternLayers.size()) {
            patternLayers.add(patternLayer);
        } else {
            patternLayers.add(index, patternLayer);
        }
        
        ArrayList<Layer> layers = new ArrayList<Layer>();
        layers.add(patternLayer);

        int insertIndex = patternLayers.indexOf(patternLayer);
        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_ADDED, insertIndex, insertIndex, layers);

        fireLayerGroupDataEvent(lde);
        
        return patternLayer;
    }
    
    @Override
    public void removeLayers(int startIndex, int endIndex) {
        
        ArrayList<Layer> layers = new ArrayList<Layer>();
        
        for (int i = endIndex; i >= startIndex; i--) {
            PatternLayer patternLayer = patternLayers.get(i);
            patternLayer.clearListeners();

            patternLayers.remove(i);

            layers.add(patternLayer);
        }

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_REMOVED, startIndex, endIndex, layers);

        fireLayerGroupDataEvent(lde);

    }
    
    @Override
    public void pushUpLayers(int startIndex, int endIndex) {
        PatternLayer a = patternLayers.remove(startIndex - 1);
        patternLayers.add(endIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, startIndex - 1, endIndex);

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public void pushDownLayers(int startIndex, int endIndex) {
        PatternLayer a = patternLayers.remove(endIndex + 1);
        patternLayers.add(startIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, startIndex, endIndex + 1);

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public int getSize() {
        return patternLayers.size();
    }

    @Override
    public Layer getLayerAt(int index) {
        return patternLayers.get(index);
    }

    @Override
    public void onLoadComplete() {
        for (PatternLayer layer : patternLayers) {
            SoundObject sObj = layer.getSoundObject();

            if (sObj instanceof OnLoadProcessable) {
                OnLoadProcessable olp = (OnLoadProcessable) sObj;
                if (olp.isOnLoadProcessable()) {
                    try {
                        olp.processOnLoad();
                    } catch (SoundObjectException soe) {
                        throw new RuntimeException(new SoundObjectException(sObj,
                                "Error during on load processing:", soe));
                    }
                }
            }
        }
    }

    @Override
    public void addLayerGroupListener(LayerGroupListener l) {
        if (layerGroupListeners == null) {
            layerGroupListeners = new Vector<LayerGroupListener>();
        }

        layerGroupListeners.add(l);
    }

    @Override
    public void removeLayerGroupListener(LayerGroupListener l) {
        if (layerGroupListeners != null) {
            layerGroupListeners.remove(l);
        }
    }

    private void fireLayerGroupDataEvent(LayerGroupDataEvent lde) {
        if (layerGroupListeners == null) {
            return;
        }

        for (LayerGroupListener listener : layerGroupListeners) {
            listener.layerGroupChanged(lde);
        }
    }
}
