/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.score.layers.audio.ui;

import blue.BlueData;
import blue.mixer.Channel;
import blue.mixer.ChannelList;
import blue.mixer.Mixer;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.audio.core.AudioLayer;
import blue.score.layers.audio.core.AudioLayerGroup;
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.List;

/**
 * This class adds logic to check for changes to AudioLayerGroups and
 * AudioLayers and ensure changes (add, remove, reorder) get synced with Mixer
 * channel groups and channels.
 *
 * @author stevenyi
 */
public class BlueProjectPropertyChangeListener implements PropertyChangeListener {

    protected BlueProject currentProject = null;
    protected ObservableListListener<LayerGroup> scoreListener;
    protected LayerGroupListener layerGroupListener;

    public BlueProjectPropertyChangeListener() {

        layerGroupListener = new LayerGroupListener() {

            @Override
            public void layerGroupChanged(LayerGroupDataEvent event) {
                if (!(event.getSource() instanceof AudioLayerGroup)) {
                    return;
                }

                AudioLayerGroup alg = (AudioLayerGroup) event.getSource();
                ChannelList list = findChannelListForAudioLayerGroup(
                        currentProject.getData().getMixer(), alg);

                switch (event.getType()) {
                    case LayerGroupDataEvent.DATA_ADDED:
                        //FIXME - handle indexes
                        for (Layer layer : event.getLayers()) {
                            AudioLayer aLayer = (AudioLayer) layer;
                            Channel channel = new Channel();
                            channel.setAssociation(aLayer.getUniqueId());
                            list.addChannel(channel);
                        }

                        break;
                    case LayerGroupDataEvent.DATA_REMOVED:
                        for (Layer layer : event.getLayers()) {
                            AudioLayer aLayer = (AudioLayer) layer;
                            String uniqueId = aLayer.getUniqueId();
                            for (int i = 0; i < list.getSize(); i++) {
                                Channel channel = list.getChannel(i);
                                if (uniqueId.equals(channel.getAssociation())) {
                                    list.removeChannel(channel);
                                    break;
                                }
                            }
                        }
                        break;
                    case LayerGroupDataEvent.DATA_CHANGED: {
                        Channel channel = list.getChannel(event.getStartIndex());
                        
                    }
                    break;
                }
            }
        };

        scoreListener = new ObservableListListener<LayerGroup>() {
            
            @Override
            public void listChanged(ObservableListEvent<LayerGroup> evt) {
                if (currentProject == null) {
                    return;
                }

                Mixer mixer = currentProject.getData().getMixer();
                List<ChannelList> channelGroups = mixer.getChannelListGroups();

                switch (evt.getType()) {
                    case ObservableListEvent.DATA_ADDED:

                        for (LayerGroup lg : evt.getAffectedItems()) {
                            if (lg instanceof AudioLayerGroup) {
                                AudioLayerGroup alg = (AudioLayerGroup) lg;
                                alg.addLayerGroupListener(layerGroupListener);
                                //FIXME - should check order of where to add

                                ChannelList channels = new ChannelList();
                                channelGroups.add(channels);
                                channels.setAssociation(
                                        alg.getUniqueId());

                                for (AudioLayer layer : alg) {
                                    Channel channel = new Channel();
                                    channel.setAssociation(layer.getUniqueId());
                                    channels.addChannel(channel);
                                }
                            }
                        }

                        break;
                    case ObservableListEvent.DATA_REMOVED:

                        for (LayerGroup lg : evt.getAffectedItems()) {
                            if (lg instanceof AudioLayerGroup) {
                                AudioLayerGroup alg = (AudioLayerGroup) lg;
                                String uniqueId = alg.getUniqueId();
                                alg.removeLayerGroupListener(layerGroupListener);

                                for (ChannelList list : channelGroups) {
                                    if (uniqueId.equals(list.getAssociation())) {
                                        channelGroups.remove(list);
                                        break;
                                    }
                                }

                            }
                        }
                        break;
                    case ObservableListEvent.DATA_CHANGED:

                        break;
                }
            }
        };
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (BlueProjectManager.CURRENT_PROJECT.equals(
                evt.getPropertyName())) {
            BlueProject oldProject = (BlueProject) evt.getOldValue();
            BlueProject newProject = (BlueProject) evt.getNewValue();

            if (oldProject == newProject) {
                return;
            }

            if (oldProject != null) {
                detachListeners(oldProject);
            }

            if (newProject != null) {
                synchronizeAudioLayersAndMixer(newProject.getData());
                attachListeners(newProject);
            }
            currentProject = newProject;
        }
    }

    protected void detachListeners(BlueProject project) {
        if (project == null) {
            return;
        }

        Score score = project.getData().getScore();

        for (LayerGroup lg : score) {
            if (lg instanceof AudioLayerGroup) {
                lg.removeLayerGroupListener(layerGroupListener);
            }
        }

        score.removeListener(scoreListener);
    }

    protected void attachListeners(BlueProject project) {
        if (project == null) {
            return;
        }

        Score score = project.getData().getScore();

        for (LayerGroup lg : score) {
            if (lg instanceof AudioLayerGroup) {
                lg.addLayerGroupListener(layerGroupListener);
            }
        }
        score.addListener(scoreListener);
    }

    ChannelList findChannelListForAudioLayerGroup(Mixer mixer, AudioLayerGroup alg) {
        String uniqueId = alg.getUniqueId();

        for (ChannelList list : mixer.getChannelListGroups()) {
            if (uniqueId.equals(list.getAssociation())) {
                return list;
            }
        }
        return null;
    }

    private void synchronizeAudioLayersAndMixer(BlueData data) {
        // TODO - Implement
    }

}
