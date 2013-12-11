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
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 *
 * @author stevenyi
 */
public class Score implements Serializable, Iterable<LayerGroup> {

    Tempo tempo = null;
    TimeState timeState = null;
    ArrayList<LayerGroup> layerGroups = new ArrayList<>();
    private NoteProcessorChain npc = new NoteProcessorChain();
    private transient ArrayList<ScoreListener> scoreListeners = null;

    public Score() {
        this(true);
    }

    private Score(boolean populate) {
        if (populate) {
            PolyObject pObj = new PolyObject(true);
            layerGroups.add(pObj);
            timeState = new TimeState();
        }
        tempo = new Tempo();
    }

    public void addLayerGroup(LayerGroup layerGroup) {
        layerGroups.add(layerGroup);
        int index = layerGroups.size() - 1;
        ScoreDataEvent sde = new ScoreDataEvent(this, ScoreDataEvent.DATA_ADDED,
                index, index);
        fireScoreDataEvent(sde);
    }

    public void addLayerGroup(int index, LayerGroup layerGroup) {
        layerGroups.add(index, layerGroup);
        ScoreDataEvent sde = new ScoreDataEvent(this, ScoreDataEvent.DATA_ADDED,
                index, index);
        fireScoreDataEvent(sde);
    }

    public void removeLayerGroups(int startIndex, int endIndex) {
        for (int i = 0; i <= (endIndex - startIndex); i++) {
            layerGroups.remove(startIndex);
        }
        ScoreDataEvent sde = new ScoreDataEvent(this,
                ScoreDataEvent.DATA_REMOVED,
                startIndex, endIndex);
        fireScoreDataEvent(sde);
    }

    public void clearLayerGroups() {
        if (layerGroups.size() == 0) {
            return;
        }

        int endIndex = layerGroups.size() - 1;
        layerGroups.clear();

        ScoreDataEvent sde = new ScoreDataEvent(this,
                ScoreDataEvent.DATA_REMOVED,
                0, endIndex);
        fireScoreDataEvent(sde);
    }

    public LayerGroup getLayerGroup(int index) {
        return layerGroups.get(index);
    }

    public int getLayerGroupCount() {
        return layerGroups.size();
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

        for (LayerGroup layerGroup : layerGroups) {
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
                    score.layerGroups.add(layerGroup);
                    break;
            }
        }

        if (score.layerGroups.size() == 0) {
            PolyObject pObj = new PolyObject(true);
            score.layerGroups.add(pObj);
        }

        return score;
    }

    public void processOnLoad() {
        for (LayerGroup layerGroup : layerGroups) {
            layerGroup.onLoadComplete();
        }
    }

    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) throws ScoreGenerationException {
        NoteList noteList = new NoteList();

        boolean soloFound = false;

        for (LayerGroup layerGroup : layerGroups) {
            soloFound = layerGroup.hasSoloLayers();
            if (soloFound) {
                break;
            }
        }

        for (LayerGroup layerGroup : layerGroups) {
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

    /* Listener Code */
    public void addScoreListener(ScoreListener listener) {
        if (scoreListeners == null) {
            scoreListeners = new ArrayList<>();
        }

        scoreListeners.add(listener);
    }

    public void removeScoreListener(ScoreListener listener) {
        if (scoreListeners != null) {
            scoreListeners.remove(listener);
        }
    }

    public void fireScoreDataEvent(ScoreDataEvent sde) {
        if (scoreListeners != null) {
            for (ScoreListener listener : scoreListeners) {
                listener.layerGroupsChanged(sde);
            }
        }
    }

    public void pushUpLayerGroups(int start, int end) {
        LayerGroup a = layerGroups.remove(start - 1);
        layerGroups.add(end, a);

        ScoreDataEvent sde = new ScoreDataEvent(this,
                ScoreDataEvent.DATA_CHANGED, start - 1, end,
                layerGroups.subList(start - 1, end + 1));

        fireScoreDataEvent(sde);
    }

    public void pushDownLayerGroups(int start, int end) {
        LayerGroup a = layerGroups.remove(end + 1);
        layerGroups.add(start, a);

        ScoreDataEvent sde = new ScoreDataEvent(this,
                ScoreDataEvent.DATA_CHANGED, start, end + 1,
                layerGroups.subList(start, end + 2));

        fireScoreDataEvent(sde);
    }

    @Override
    public Iterator<LayerGroup> iterator() {
        return layerGroups.iterator();
    }

    public List<LayerGroup> getLayersForScoreObjects(Collection<? extends ScoreObject> scoreObjects) {
        List<LayerGroup> retVal = new ArrayList<>();

        for (LayerGroup<Layer> layerGroup : layerGroups) {
            for (Layer layer : layerGroup) {
                boolean found = false;
                if (layer instanceof ScoreObjectLayer) {
                    ScoreObjectLayer scoreLayer = (ScoreObjectLayer) layer;
                    if (!Collections.disjoint(scoreLayer, scoreObjects)) {
                        retVal.add(layerGroup);
                        found = true;
                    }
                }

                if(found) {
                    break;
                }
            }
        }

        return retVal;
    }
}
