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
import blue.score.layers.audio.ui.bindings.AudioLayerChannelBinding;
import blue.score.layers.audio.ui.bindings.AudioLayerGroupBinding;
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * This class adds logic to check for changes to AudioLayerGroups and
 * AudioLayers and ensure changes (add, remove, reorder) get synced with Mixer
 * channel groups and channels.
 *
 * @author stevenyi
 */
public class BlueProjectPropertyChangeListener implements PropertyChangeListener {

    protected BlueProject currentProject = null;
    protected ObservableListListener<LayerGroup<? extends Layer>> scoreListener;
    protected LayerGroupListener layerGroupListener;
    
    protected Map<AudioLayerGroup, AudioLayerGroupBinding> layerGroupBindings;
    protected Map<AudioLayer, AudioLayerChannelBinding> layerBindings;

    public BlueProjectPropertyChangeListener() {
        layerGroupBindings = new HashMap<>();
        layerBindings = new HashMap<>();

        layerGroupListener = (LayerGroupDataEvent event) -> {
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
                        list.add(channel);
                        
                        layerBindings.put(aLayer,
                                new AudioLayerChannelBinding(aLayer, channel));
                    }
                    
                    break;
                case LayerGroupDataEvent.DATA_REMOVED:
                    for (Layer layer : event.getLayers()) {
                        AudioLayer aLayer = (AudioLayer) layer;
                        String uniqueId = aLayer.getUniqueId();
                        for (int i = 0; i < list.size(); i++) {
                            Channel channel = list.get(i);
                            if (uniqueId.equals(channel.getAssociation())) {
                                list.remove(channel);
                                break;
                            }
                        }
                        
                        if(layerBindings.containsKey(aLayer)) {
                            layerBindings.get(aLayer).clearBinding();
                            layerBindings.remove(aLayer);
                        }
                    }
                    break;
                case LayerGroupDataEvent.DATA_CHANGED: {
                    
                }
                break;
            }
        };

        scoreListener = new ObservableListListener<LayerGroup<?>>() {
            /* TODO - May need to introduce a new interface for layerGroups that
             * require matching mixer channel lists if new layer groups require
             * that functionality, so that channel lists can be sorted correctly
             */
            @Override
            public void listChanged(ObservableListEvent<LayerGroup<?>> evt) {
                if (currentProject == null) {
                    return;
                }

                Mixer mixer = currentProject.getData().getMixer();
                List<ChannelList> channelGroups = mixer.getChannelListGroups();

                switch (evt.getType()) {
                    case ObservableListEvent.DATA_ADDED:

                        for (LayerGroup<? extends Layer> lg : evt.getAffectedItems()) {
                            if (lg instanceof AudioLayerGroup) {
                                AudioLayerGroup alg = (AudioLayerGroup) lg;
                                alg.addLayerGroupListener(layerGroupListener);
                                //FIXME - should check order of where to add

                                ChannelList channels = new ChannelList();
                                channelGroups.add(channels);
                                channels.setAssociation(
                                        alg.getUniqueId());
                                channels.setListName(alg.getName());
                                channels.setListNameEditSupported(true);
                                
                                layerGroupBindings.put(alg, 
                                        new AudioLayerGroupBinding(alg, channels));

                                for (AudioLayer layer : alg) {
                                    Channel channel = new Channel();
                                    channel.setAssociation(layer.getUniqueId());
                                    channels.add(channel);
                                    
                                    layerBindings.put(layer, 
                                            new AudioLayerChannelBinding(layer,
                                                    channel));
                                }
                            }
                        }

                        break;
                    case ObservableListEvent.DATA_REMOVED:

                        for (LayerGroup<? extends Layer> lg : evt.getAffectedItems()) {
                            if (lg instanceof AudioLayerGroup) {
                                AudioLayerGroup alg = (AudioLayerGroup) lg;
                                String uniqueId = alg.getUniqueId();
                                alg.removeLayerGroupListener(layerGroupListener);

                                if(layerGroupBindings.containsKey(alg)) {
                                    AudioLayerGroupBinding binding = layerGroupBindings.get(alg);
                                    binding.clearBinding();
                                    layerGroupBindings.remove(alg);
                                }
        
                                for (ChannelList list : channelGroups) {
                                    if (uniqueId.equals(list.getAssociation())) {
                                        channelGroups.remove(list);
                                        
                                        break;
                                    }
                                }
                                for (AudioLayer layer : alg) {
                                    if(layerBindings.containsKey(layer)) {
                                        AudioLayerChannelBinding binding = layerBindings.get(layer);
                                        binding.clearBinding();
                                        layerBindings.remove(layer);
                                    }
                                }
                               
                            }
                        }
                        break;
                    case ObservableListEvent.DATA_CHANGED: {

                        List<LayerGroup<?>> affectedItems = evt.getAffectedItems();
                        List<AudioLayerGroup> affectedAudioGroups = new ArrayList<>();
                        for (LayerGroup<?> layerGroup : affectedItems) {
                            if (layerGroup instanceof AudioLayerGroup) {
                                affectedAudioGroups.add(
                                        (AudioLayerGroup) layerGroup);
                            }
                        }

                        if (affectedAudioGroups.size() <= 1) {
                            return;
                        }

                        if (evt.getSubType() == ObservableListEvent.DATA_PUSHED_DOWN) {
                            if (affectedItems.get(0) instanceof AudioLayerGroup) {
                                ChannelList first = findChanneListByAssociation(
                                        channelGroups,
                                        affectedAudioGroups.get(0).getUniqueId());
                                ChannelList second = findChanneListByAssociation(
                                        channelGroups,
                                        affectedAudioGroups.get(1).getUniqueId());

                                channelGroups.remove(first);
                                channelGroups.add(channelGroups.indexOf(second),
                                        first);

                            }

                        } else if (evt.getSubType() == ObservableListEvent.DATA_PUSHED_UP) {
                            if (affectedItems.get(affectedItems.size() - 1) instanceof AudioLayerGroup) {
                                ChannelList newLast = findChanneListByAssociation(
                                        channelGroups,
                                        affectedAudioGroups.get(affectedAudioGroups.size() - 1).getUniqueId());
                                ChannelList second = findChanneListByAssociation(
                                        channelGroups,
                                        affectedAudioGroups.get(affectedItems.size() - 2).getUniqueId());

                                channelGroups.remove(newLast);
                                channelGroups.add(channelGroups.indexOf(
                                        second), newLast);

                            }
                        }

                        break;
                    }
                }
            }

            private ChannelList findChanneListByAssociation(List<ChannelList> channelLists, String uniqueId) {
                for (ChannelList list : channelLists) {
                    if (uniqueId.equals(list.getAssociation())) {
                        return list;
                    }
                }
                return null;
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
            
            for(AudioLayerGroupBinding binding: layerGroupBindings.values()) {
                binding.clearBinding();
            }
            layerGroupBindings.clear();
            
            for(AudioLayerChannelBinding binding: layerBindings.values()) {
                binding.clearBinding();
            }
            layerBindings.clear();

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

        for (LayerGroup<? extends Layer> lg : score) {
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
        Mixer mixer = project.getData().getMixer();

        for (LayerGroup<? extends Layer> lg : score) {
            if (lg instanceof AudioLayerGroup) {
                AudioLayerGroup alg = (AudioLayerGroup)lg;
                ChannelList channelList = findChannelListForAudioLayerGroup(mixer, alg);
                
                lg.addLayerGroupListener(layerGroupListener);
                
                AudioLayerGroupBinding binding = new AudioLayerGroupBinding(alg, channelList);
                layerGroupBindings.put(alg, binding);
                
                for(AudioLayer layer : alg) {
                    Channel channel = ChannelList.findChannelByAssociation(channelList, 
                            layer.getUniqueId());
                    
                    if(channel != null) {
                        layerBindings.put(layer, new AudioLayerChannelBinding(layer, channel));
                    }
                    
                }
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
