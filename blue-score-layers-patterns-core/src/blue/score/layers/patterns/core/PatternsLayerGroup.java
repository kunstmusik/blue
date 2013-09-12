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
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.score.ScoreGenerationException;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.*;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Map;
import java.util.Vector;

/**
 *
 * @author stevenyi
 */
public class PatternsLayerGroup implements LayerGroup<PatternLayer> {

    private transient Vector<LayerGroupListener> layerGroupListeners = null;
    private ArrayList<PatternLayer> patternLayers = new ArrayList<PatternLayer>();
    private int patternBeatsLength = 4;
    private String name = "Patterns Layer Group";
    private NoteProcessorChain npc = new NoteProcessorChain();

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        this.name = name;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        this.npc = npc;
    }

    public int getPatternBeatsLength() {
        return patternBeatsLength;
    }

    public void setPatternBeatsLength(int patternBeatsLength) {
        this.patternBeatsLength = patternBeatsLength;
    }

    @Override
    public boolean hasSoloLayers() {
        for (PatternLayer layer : patternLayers) {
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
            for (PatternLayer patternLayer : patternLayers) {
                if (patternLayer.isSolo()) {
                    if (!patternLayer.isMuted()) {
                        noteList.merge(patternLayer.generateForCSD(compileData,
                                startTime, endTime,
                                patternBeatsLength));
                    }
                }
            }
        } else {
            for (PatternLayer patternLayer : patternLayers) {
                if (!patternLayer.isMuted()) {
                    noteList.merge(patternLayer.generateForCSD(compileData,
                            startTime, endTime,
                            patternBeatsLength));
                }
            }
        }
        try {
            noteList = processNotes(compileData, noteList, startTime, endTime);
        } catch (NoteProcessorException ex) {
            throw new ScoreGenerationException(ex);
        }

        return noteList;
    }

    private NoteList processNotes(CompileData compileData, NoteList nl, float start, float endTime) throws NoteProcessorException {

        NoteList retVal = null;

        
        ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        

        if (start == 0.0f) {
            retVal = nl;
        } else {
            ScoreUtilities.setScoreStart(nl, -start);

            NoteList buffer = new NoteList();
            Note tempNote;

            for (int i = 0; i < nl.size(); i++) {
                tempNote = nl.getNote(i);

                if (tempNote.getStartTime() >= 0) {
                    buffer.addNote(tempNote);
                }
            }
            retVal = buffer;
        }

        if (endTime > start) {
            // float dur = endTime - start;

            NoteList buffer = new NoteList();
            Note tempNote;

            for (int i = 0; i < retVal.size(); i++) {
                tempNote = retVal.getNote(i);

                if (tempNote.getStartTime() <= endTime) {
                    buffer.addNote(tempNote);
                }
            }
            retVal = buffer;
        }

        return retVal;
    }

    public static PatternsLayerGroup loadFromXML(Element data) throws Exception {
        PatternsLayerGroup layerGroup = new PatternsLayerGroup();

        if (data.getAttribute("name") != null) {
            layerGroup.setName(data.getAttributeValue("name"));
        }

        Elements nodes = data.getElements();
        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if ("patternLayers".equals(nodeName)) {

                Elements patternNodes = node.getElements();

                while (patternNodes.hasMoreElements()) {

                    Element patternNode = patternNodes.next();

                    if ("patternLayer".equals(patternNode.getName())) {
                        layerGroup.patternLayers.add(PatternLayer.loadFromXML(
                                patternNode));
                    }
                }
            } else if ("noteProcessorChain".equals(nodeName)) {
                layerGroup.setNoteProcessorChain(NoteProcessorChain.loadFromXML(
                        node));
            }
        }

        return layerGroup;
    }

    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element root = new Element("patternsLayerGroup");
        root.setAttribute("name", name);

        Element patternsNode = root.addElement("patternLayers");

        for (PatternLayer layer : patternLayers) {
            patternsNode.addElement(layer.saveAsXML());
        }

        root.addElement(npc.saveAsXML());

        return root;
    }

    @Override
    public PatternLayer newLayerAt(int index) {

        PatternLayer patternLayer = new PatternLayer();

        if (index < 0 || index >= patternLayers.size()) {
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
                LayerGroupDataEvent.DATA_CHANGED, -startIndex, -(endIndex + 1));

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public int getSize() {
        return patternLayers.size();
    }

    @Override
    public PatternLayer getLayerAt(int index) {
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

    public int getMaxPattern() {
        int max = 0;
        for (PatternLayer layer : patternLayers) {
            if (layer.getPatternData().getMaxSelected() > max) {
                max = layer.getPatternData().getMaxSelected();
            }
        }
        return max;
    }
}
