/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.score.layers.audio.core;

import blue.CompileData;
import blue.SoundLayer;
import blue.noteProcessor.NoteProcessorChain;
import blue.score.ScoreGenerationException;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.*;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Map;
import java.util.Vector;

/**
 *
 * @author stevenyi
 */
public class AudioLayerGroup implements LayerGroup<AudioLayer> {

    private transient Vector<LayerGroupListener> layerGroupListeners = null;
    private ArrayList<AudioLayer> audioLayers = new ArrayList<AudioLayer>();
    private String name = "Audio Layer Group";

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        this.name = name;
    }

    @Override
    public boolean hasSoloLayers() {
        for (AudioLayer layer : audioLayers) {
            if (layer.isSolo()) {
                return true;
            }
        }
        return false;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime, boolean processWithSolo) throws ScoreGenerationException {

        NoteList noteList = new NoteList();

        if (processWithSolo) {
        } else {
        }

        return noteList;
    }

    public static AudioLayerGroup loadFromXML(Element data) throws Exception {
        AudioLayerGroup layerGroup = new AudioLayerGroup();

        if (data.getAttribute("name") != null) {
            layerGroup.setName(data.getAttributeValue("name"));
        }

        Elements nodes = data.getElements();
        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if ("audioLayers".equals(nodeName)) {
                Elements aLayerNodes = node.getElements();
                while(aLayerNodes.hasMoreElements()) {
                    layerGroup.audioLayers.add(
                            AudioLayer.loadFromXML(aLayerNodes.next()));
                }
            }
        }

        return layerGroup;
    }

    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element root = new Element("audioLayerGroup");
        root.setAttribute("name", name);

        Element audioLayersNode = root.addElement("audioLayers");

        for (AudioLayer layer : audioLayers) {
            audioLayersNode.addElement(layer.saveAsXML());
        }

        return root;
    }

    @Override
    public AudioLayer newLayerAt(int index) {

        AudioLayer audioLayer = new AudioLayer();

        if (index < 0 || index >= audioLayers.size()) {
            audioLayers.add(audioLayer);
        } else {
            audioLayers.add(index, audioLayer);
        }

        ArrayList<Layer> layers = new ArrayList<Layer>();
        layers.add(audioLayer);

        int insertIndex = audioLayers.indexOf(audioLayer);
        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_ADDED, insertIndex, insertIndex, layers);

        fireLayerGroupDataEvent(lde);

        return audioLayer;
    }

    @Override
    public void removeLayers(int startIndex, int endIndex) {

        ArrayList<Layer> layers = new ArrayList<Layer>();

        for (int i = endIndex; i >= startIndex; i--) {
            AudioLayer audioLayer = audioLayers.get(i);
            audioLayer.clearListeners();

            audioLayers.remove(i);

            layers.add(audioLayer);
        }

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_REMOVED, startIndex, endIndex, layers);

        fireLayerGroupDataEvent(lde);

    }

    @Override
    public void pushUpLayers(int startIndex, int endIndex) {
        AudioLayer a = audioLayers.remove(startIndex - 1);
        audioLayers.add(endIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, startIndex - 1, endIndex);

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public void pushDownLayers(int startIndex, int endIndex) {
        AudioLayer a = audioLayers.remove(endIndex + 1);
        audioLayers.add(startIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, -startIndex, -(endIndex + 1));

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public int getSize() {
        return audioLayers.size();
    }

    @Override
    public AudioLayer getLayerAt(int index) {
        return audioLayers.get(index);
    }

    @Override
    public void onLoadComplete() {
//        for (AudioLayer layer : audioLayers) {
            //
//        }
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

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public int getTotalHeight() {
        int runningHeight = 0;
        for (AudioLayer layer : audioLayers) {
            runningHeight += (layer.getHeightIndex() + 1);
        }
        return runningHeight * Layer.LAYER_HEIGHT;
    }

    public int getMaxTime() {
        return 0;
    }


   public int getLayerNumForY(int y) {
        int runningY = 0;

        for (int i = 0; i < audioLayers.size(); i++) {
            AudioLayer layer = (AudioLayer) audioLayers.get(i);
            runningY += layer.getAudioLayerHeight();

            if (runningY > y) {
                return i;
            }
        }

        return audioLayers.size() - 1;
    }
}
