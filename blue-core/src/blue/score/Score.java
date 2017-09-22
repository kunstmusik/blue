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
package blue.score;

import blue.CompileData;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupProviderManager;
import blue.score.layers.ScoreObjectLayer;
import blue.score.tempo.Tempo;
import blue.soundObject.NoteList;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.util.ObservableArrayList;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 *
 * @author stevenyi
 */
public class Score extends ObservableArrayList<LayerGroup<? extends Layer>> {

    Tempo tempo = null;
    TimeState timeState = null;
    private NoteProcessorChain npc; 

    public static final int SPACER = 36;

    public Score() {
        this(true);
    }

    private Score(boolean populate) {
        if (populate) {
            PolyObject pObj = new PolyObject(true);
            add(pObj);
            timeState = new TimeState();
        }
        npc = new NoteProcessorChain();
        tempo = new Tempo();
    }

    public Score(Score score) {
        timeState = new TimeState(score.timeState);
        npc = new NoteProcessorChain(score.npc);
        tempo = new Tempo(score.tempo);

        for(LayerGroup<? extends Layer> lg :score) {
            add(lg.deepCopyLG());    
        }
    }


    public Tempo getTempo() {
        return tempo;
    }

    public void setTempo(Tempo tempo) {
        this.tempo = tempo;
    }

    public TimeState getTimeState() {
        return timeState;
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        this.npc = npc;
    }

    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = new Element("score");
        retVal.addElement(tempo.saveAsXML());
        retVal.addElement(timeState.saveAsXML());
        retVal.addElement(npc.saveAsXML());

        for (LayerGroup layerGroup : this) {
            retVal.addElement(layerGroup.saveAsXML(objRefMap));
        }

        return retVal;
    }

    public static Score loadFromXML(Element data, Map<String, Object> objRefMap) throws Exception {
        Score score = new Score(false);

        Elements nodes = data.getElements();

        LayerGroupProviderManager manager = LayerGroupProviderManager.getInstance();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "tempo":
                    score.tempo = Tempo.loadFromXML(node);
                    break;
                case "timeState":
                    score.timeState = TimeState.loadFromXML(node);
                    break;
                case "noteProcessorChain":
                    score.npc = NoteProcessorChain.loadFromXML(node);
                    break;
                default:
                    LayerGroup layerGroup = manager.loadFromXML(node, objRefMap);
                    if (layerGroup == null) {
                        throw new RuntimeException(
                                "Unable to load Score LayerGroup of type: " + node.getName());
                    }
                    score.add(layerGroup);
                    if(layerGroup instanceof PolyObject) {
                        ((PolyObject)layerGroup).setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
                    }
                    break;
            }
        }

        if (score.size() == 0) {
            PolyObject pObj = new PolyObject(true);
            score.add(pObj);
        }

        return score;
    }

    public void processOnLoad() {
        for (LayerGroup layerGroup : this) {
            layerGroup.onLoadComplete();
        }
    }

    public NoteList generateForCSD(CompileData compileData, double startTime, double endTime) throws ScoreGenerationException {
        NoteList noteList = new NoteList();

        boolean soloFound = false;

        for (LayerGroup layerGroup : this) {
            soloFound = layerGroup.hasSoloLayers();
            if (soloFound) {
                break;
            }
        }

        for (LayerGroup layerGroup : this) {
            NoteList nl = layerGroup.generateForCSD(compileData, startTime,
                    endTime, soloFound);
            noteList.merge(nl);
        }

        try {
            ScoreUtilities.applyNoteProcessorChain(noteList, this.npc);
        } catch (NoteProcessorException e) {
            throw new ScoreGenerationException(e);
        }

        return noteList;
    }

    public List<LayerGroup> getLayerGroupsForScoreObjects(Collection<? extends ScoreObject> scoreObjects) {
        List<LayerGroup> retVal = new ArrayList<>();

        for (LayerGroup<? extends Layer> layerGroup : this) {
            for (Layer layer : layerGroup) {
                boolean found = false;
                if (layer instanceof ScoreObjectLayer) {
                    ScoreObjectLayer scoreLayer = (ScoreObjectLayer) layer;
                    if (!Collections.disjoint(scoreLayer, scoreObjects)) {
                        retVal.add(layerGroup);
                        found = true;
                    }
                }

                if (found) {
                    break;
                }
            }
        }

        return retVal;
    }

    /* Returns a flat list of all layers in the Score from each LayerGroup */
    public List<Layer> getAllLayers() {
        List<Layer> retVal = new ArrayList<>();

        for (LayerGroup<? extends Layer> layerGroup : this) {
            retVal.addAll(layerGroup);
        }
        return retVal;
    }

    public int getGlobalLayerIndexForY(int y) {
        int runningY = 0;
        int runningIndex = 0;

        for (LayerGroup<? extends Layer> layerGroup : this) {
            for (Layer layer : layerGroup) {
                if (y <= runningY + layer.getLayerHeight()) {
                    return runningIndex;
                }
                runningY += layer.getLayerHeight();
                runningIndex += 1;
            }
            if (y <= runningY + SPACER) {
                return runningIndex;
            }
            runningY += SPACER;
        }

        return runningIndex - 1;
    }

    public Layer getGlobalLayerForY(int y) {
        int runningY = 0;

        for (LayerGroup<? extends Layer> layerGroup : this) {
            for (Layer layer : layerGroup) {
                if (y <= runningY + layer.getLayerHeight()) {
                    return layer;
                }
                runningY += layer.getLayerHeight();
            }
            if (y <= runningY + SPACER) {
                return null;
            }
            runningY += SPACER;
        }

        return null;
    }

    @Override
    public int hashCode() {
        int hash = 7;
        hash = 79 * hash + Objects.hashCode(this.tempo);
        hash = 79 * hash + Objects.hashCode(this.timeState);
        return hash;
    }


    @Override
    public boolean equals(Object obj) {
        return obj == this;
    }

     
}
