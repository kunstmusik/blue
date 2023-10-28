/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.automation;

import blue.Arrangement;
import blue.BlueData;
import blue.InstrumentAssignment;
import blue.SoundLayer;
import blue.mixer.Channel;
import blue.mixer.ChannelList;
import blue.mixer.Effect;
import blue.mixer.EffectsChain;
import blue.mixer.Mixer;
import blue.mixer.Send;
import blue.orchestra.Instrument;
import blue.score.Score;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.PolyObject;
import blue.ui.utilities.MenuScroller;
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import java.awt.Color;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import javafx.collections.ListChangeListener;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import org.apache.commons.lang3.builder.ToStringBuilder;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;

/**
 * Controller to handle synchronizing of UI with time, directing single edits in
 * control UI to values in parameter lines.
 *
 * Builds list of Automations for SoundLayerPanels. (Traverses Arrangement and
 * Mixer)
 *
 * Removes Automations from SoundLayers when Parameter is removed.
 *
 * @author steven
 */
public class AutomationManager implements
        AutomatableCollectionListener, ObservableListListener<Channel>, LayerGroupListener {

    /**
     * cache of all parameters in project
     */
    private final ArrayList<Parameter> allParameters = new ArrayList<>();
    BlueData data = null;
    Score score = null;
    ActionListener parameterActionListener;
    private ParameterIdList selectedParamIdList = null;
    private static AutomationManager instance = null;
    PropertyChangeListener renderTimeListener;
    ObservableListListener<ChannelList> channelListListener;
    ListChangeListener<Parameter> parameterListListener;

    private AutomationManager() {
        parameterActionListener = (ActionEvent ae) -> {
            if (data == null || selectedParamIdList == null) {
                return;
            }

            JMenuItem menuItem = (JMenuItem) ae.getSource();

            Parameter param = (Parameter) menuItem.getClientProperty("param");

            parameterSelected(selectedParamIdList, param);

            selectedParamIdList = null;
        };

        renderTimeListener = (PropertyChangeEvent pce) -> {
            if (pce.getSource() == data) {
                if (pce.getPropertyName().equals("renderStartTime")) {
                    updateValuesFromAutomations();
                }
            }
        };

        channelListListener = e -> {
            List<ChannelList> items = e.getAffectedItems();
            switch (e.getType()) {
                case ObservableListEvent.DATA_ADDED:
                    for (ChannelList cList : items) {
                        cList.addListener(AutomationManager.this);
                        for (Channel c : cList) {
                            addListenerToChannel(c);
                        }
                    }
                    break;
                case ObservableListEvent.DATA_REMOVED:
                    for (ChannelList cList : items) {
                        cList.removeListener(AutomationManager.this);
                        for (Channel c : cList) {
                            removeListenerFromChannel(c);
                        }
                    }
                    break;
            }
        };

        parameterListListener = e -> {
            while (e.next()) {
                for (Parameter param : e.getAddedSubList()) {
                    parameterAdded(param);
                }
                for (Parameter param : e.getRemoved()) {
                    parameterRemoved(param);
                }
            }
        };
    }

    public static AutomationManager getInstance() {
        if (instance == null) {
            instance = new AutomationManager();
        }
        return instance;
    }

    /**
     * When parameter is selected, check if this parameter is in use and if by
     * this soundLayer, turn it off, otherwise move it to this soundLayer.
     *
     * @param soundLayer
     * @param param
     */
    private void parameterSelected(ParameterIdList paramIdList, Parameter param) {
        String uniqueId = param.getUniqueId();

        if (param.isAutomationEnabled()) {
            if (paramIdList.contains(uniqueId)) {
                param.setAutomationEnabled(false);
                paramIdList.removeParameterId(uniqueId);
            } else {

                //TODO - This class needs further updating for generic 
                //LayerGroup Design
                Score score = data.getScore();

                for (LayerGroup<? extends Layer> layerGroup : score) {

                    if (!(layerGroup instanceof PolyObject)) {
                        continue;
                    }

                    PolyObject pObj = (PolyObject) layerGroup;

                    for (SoundLayer layer : pObj) {
                        if (layer.getAutomationParameters() == paramIdList) {
                            continue;
                        }

                        ParameterIdList automationParameters = layer.getAutomationParameters();

                        if (automationParameters.contains(uniqueId)) {
                            automationParameters.removeParameterId(uniqueId);
                        }
                    }
                }

                paramIdList.addParameterId(uniqueId);
            }
        } else {
            param.setAutomationEnabled(true);
            param.getLine().setColor(LineColors.getColor(paramIdList.size()));
            paramIdList.addParameterId(uniqueId);
            param.fireUpdateFromTimeChange();
        }
    }

    public void setData(BlueData data) {
        if (this.data != null) {
            Arrangement arrangement = this.data.getArrangement();
            arrangement.removeAutomatableCollectionListener(this);

            for (int i = 0; i < arrangement.size(); i++) {
                Instrument instr = arrangement.getInstrument(i);

                if (instr instanceof Automatable) {
                    Automatable temp = (Automatable) instr;
                    ParameterList parameters = temp.getParameterList();

                    // parameterMap.put(temp, parameters);
                    parameters.removeListener(parameterListListener);
                }
            }

            Mixer mixer = this.data.getMixer();
            mixer.getChannelListGroups().removeListener(channelListListener);

            for (ChannelList list : mixer.getChannelListGroups()) {
                list.removeListener(this);
                for (Channel c : list) {
                    removeListenerFromChannel(c);
                }
            }
            ChannelList channels = mixer.getChannels();
            channels.removeListener(this);
            for (Channel c : channels) {
                removeListenerFromChannel(c);
            }

            ChannelList subChannels = mixer.getSubChannels();
            subChannels.removeListener(this);
            for (int i = 0; i < subChannels.size(); i++) {
                removeListenerFromChannel(subChannels.get(i));
            }

            removeListenerFromChannel(mixer.getMaster());

            if (this.score != null) {
                for (LayerGroup<? extends Layer> layerGroup : score) {
                    layerGroup.removeLayerGroupListener(this);
                }
            }

            this.data.removePropertyChangeListener(renderTimeListener);
        }

        // menu = null;
        // dirty = false;
        allParameters.clear();

        if (data == null) {
            return;
        }

        // Build Map from Instruments
        Arrangement arrangement = data.getArrangement();

        for (int i = 0; i < arrangement.size(); i++) {
            Instrument instr = arrangement.getInstrument(i);

            if (instr instanceof Automatable) {
                Automatable temp = (Automatable) instr;
                ParameterList parameters = temp.getParameterList();

                allParameters.addAll(parameters);

                parameters.addListener(parameterListListener);
            }
        }

        arrangement.addAutomatableCollectionListener(this);

        Mixer mixer = data.getMixer();
        mixer.getChannelListGroups().addListener(channelListListener);

        for (ChannelList list : mixer.getChannelListGroups()) {
            list.addListener(this);
            for (Channel c : list) {
                addListenerToChannel(c);
            }
        }
        ChannelList channels = mixer.getChannels();
        channels.addListener(this);
        for (Channel c : channels) {
            addListenerToChannel(c);
        }

        ChannelList subChannels = mixer.getSubChannels();
        subChannels.addListener(this);
        for (int i = 0; i < subChannels.size(); i++) {
            addListenerToChannel(subChannels.get(i));
        }

        addListenerToChannel(mixer.getMaster());

        // System.err.println(this);
        this.data = data;

        this.score = data.getScore();

        for (LayerGroup<? extends Layer> layerGroup : this.score) {
            layerGroup.addLayerGroupListener(this);
        }

        this.data.addPropertyChangeListener(renderTimeListener);

        // Build Map from Mixer Channels
    }

    private void addListenerToChannel(Channel channel) {
        EffectsChain pre = channel.getPreEffects();
        pre.addAutomatableCollectionListener(this);
        for (int i = 0; i < pre.size(); i++) {
            ParameterList parameterList = ((Automatable) pre.getElementAt(i)).getParameterList();
            parameterList.addListener(parameterListListener);
            allParameters.addAll(parameterList);
        }

        EffectsChain post = channel.getPostEffects();
        post.addAutomatableCollectionListener(this);
        for (int i = 0; i < post.size(); i++) {
            ParameterList parameterList = ((Automatable) post.getElementAt(i)).getParameterList();
            parameterList.addListener(parameterListListener);
            allParameters.addAll(parameterList);
        }

        allParameters.add(channel.getLevelParameter());
    }

    private void removeListenerFromChannel(Channel channel) {
        EffectsChain pre = channel.getPreEffects();
        pre.removeAutomatableCollectionListener(this);
        for (int i = 0; i < pre.size(); i++) {
            ((Automatable) pre.getElementAt(i)).getParameterList().removeListener(
                    parameterListListener);
        }

        EffectsChain post = channel.getPostEffects();
        post.removeAutomatableCollectionListener(this);
        for (int i = 0; i < post.size(); i++) {
            ((Automatable) post.getElementAt(i)).getParameterList().removeListener(
                    parameterListListener);
        }
    }

    public JPopupMenu getAutomationMenu(ParameterIdList paramIdList) {
        this.selectedParamIdList = paramIdList;

        // if (menu == null || dirty) {
        JPopupMenu menu = new JPopupMenu();

        // Build Instrument Menu
        JMenu instrRoot = new JMenu("Instrument");
        MenuScroller.setScrollerFor(instrRoot);

        Arrangement arrangement = data.getArrangement();

        for (int i = 0; i < arrangement.size(); i++) {
            InstrumentAssignment ia = arrangement.getInstrumentAssignment(i);

            if (ia.enabled && ia.instr instanceof Automatable) {

                ParameterList params = ((Automatable) ia.instr).getParameterList();

                if (params.size() <= 0) {
                    continue;
                }

                final JMenu instrMenu = new JMenu();
                MenuScroller.setScrollerFor(instrMenu);

                instrMenu.setText(ia.arrangementId + ") " + ia.instr.getName());

                for (Parameter param : params.sorted()) {
                    JMenuItem paramItem = new JMenuItem();
                    paramItem.setText(param.getName());
                    paramItem.addActionListener(parameterActionListener);

                    if (param.isAutomationEnabled()) {
                        if (paramIdList.contains(param.getUniqueId())) {
                            paramItem.setForeground(Color.GREEN);
                        } else {
                            paramItem.setForeground(Color.ORANGE);
                        }

                    }

                    paramItem.putClientProperty("instr", ia.instr);
                    paramItem.putClientProperty("param", param);

                    instrMenu.add(paramItem);
                }
                instrRoot.add(instrMenu);
            }
        }

        menu.add(instrRoot);

        // Build Mixer Menu
        Mixer mixer = data.getMixer();

        if (mixer.isEnabled()) {
            JMenu mixerRoot = new JMenu("Mixer");
            MenuScroller.setScrollerFor(mixerRoot);
            // add channels
            ChannelList channels = mixer.getChannels();

            if (channels.size() > 0) {
                JMenu channelsMenu = new JMenu("Channels");

                for (int i = 0; i < channels.size(); i++) {
                    channelsMenu.add(buildChannelMenu(channels.get(i),
                            paramIdList));
                }

                mixerRoot.add(channelsMenu);
            }

            // add subchannels
            ChannelList subChannels = mixer.getSubChannels();

            if (subChannels.size() > 0) {
                JMenu subChannelsMenu = new JMenu("Sub-Channels");
                for (int i = 0; i < subChannels.size(); i++) {
                    subChannelsMenu.add(buildChannelMenu(subChannels.get(
                            i), paramIdList));
                }

                mixerRoot.add(subChannelsMenu);
            }

            // add master channel
            Channel master = mixer.getMaster();

            mixerRoot.add(buildChannelMenu(master, paramIdList));

            menu.add(mixerRoot);
        }

        menu.addSeparator();

        JMenuItem clearAll = new JMenuItem("Clear All");
        clearAll.addActionListener((ActionEvent e) -> {
            Object retVal = DialogDisplayer.getDefault().notify(
                    new NotifyDescriptor.Confirmation(
                            "Please Confirm Clearing All Parameter Data for this SoundLayer"));

            if (retVal == NotifyDescriptor.YES_OPTION) {

                ParameterIdList idList = selectedParamIdList;
                var copy = new ArrayList<String>(idList.getParameters());

                for (String paramId : copy) {
                    Parameter param = getParameter(paramId);

                    param.setAutomationEnabled(false);
                    idList.removeParameterId(paramId);
                }
            }
        });
        menu.add(clearAll);

        clearAll.setEnabled(selectedParamIdList.size() > 0);

        // }
        // System.err.println(parameterMap);
        return menu;
    }

    public JMenu buildChannelMenu(Channel channel, ParameterIdList paramIdList) {
        this.selectedParamIdList = paramIdList;

        JMenu retVal = new JMenu();

        retVal.setText(channel.getName());

        // pre effects
        EffectsChain preEffects = channel.getPreEffects();

        if (preEffects.size() > 0) {
            JMenu preMenu = new JMenu("Pre-Effects");
            retVal.add(preMenu);
            MenuScroller.setScrollerFor(preMenu);

            for (int i = 0; i < preEffects.size(); i++) {
                Automatable automatable = (Automatable) preEffects.getElementAt(
                        i);

                ParameterList params = automatable.getParameterList();

                if (params.size() > 0) {
                    JMenu effectMenu = new JMenu();
                    MenuScroller.setScrollerFor(effectMenu);

                    if (automatable instanceof Effect) {
                        effectMenu.setText(((Effect) automatable).getName());
                    } else if (automatable instanceof Send) {
                        effectMenu.setText("Send: "
                                + ((Send) automatable).getSendChannel());
                    } else {
                        effectMenu.setText("ERROR");
                    }

                    preMenu.add(effectMenu);

                    for (Parameter param : params.sorted()) {
                        JMenuItem paramItem = new JMenuItem();
                        paramItem.setText(param.getName());
                        paramItem.addActionListener(parameterActionListener);

                        if (param.isAutomationEnabled()) {
                            if (paramIdList.contains(param.getUniqueId())) {
                                paramItem.setForeground(Color.GREEN);
                            } else {
                                paramItem.setForeground(Color.ORANGE);
                            }

                        }

                        paramItem.putClientProperty("param", param);

                        effectMenu.add(paramItem);
                    }
                }
            }
        }

        // volume
        JMenuItem volItem = new JMenuItem("Volume");
        Parameter volParam = channel.getLevelParameter();
        volItem.putClientProperty("param", volParam);
        volItem.addActionListener(parameterActionListener);

        if (volParam.isAutomationEnabled()) {
            if (paramIdList.contains(volParam.getUniqueId())) {
                volItem.setForeground(Color.GREEN);
            } else {
                volItem.setForeground(Color.ORANGE);
            }

        }

        retVal.add(volItem);

        // post effects
        EffectsChain postEffects = channel.getPostEffects();

        if (postEffects.size() > 0) {
            JMenu postMenu = new JMenu("Post-Effects");
            MenuScroller.setScrollerFor(postMenu);
            retVal.add(postMenu);

            for (int i = 0; i < postEffects.size(); i++) {
                Automatable automatable = (Automatable) postEffects.getElementAt(
                        i);

                ParameterList params = automatable.getParameterList();

                if (params.size() > 0) {
                    JMenu effectMenu = new JMenu();
                    MenuScroller.setScrollerFor(effectMenu);

                    if (automatable instanceof Effect) {
                        effectMenu.setText(((Effect) automatable).getName());
                    } else if (automatable instanceof Send) {
                        effectMenu.setText("Send: "
                                + ((Send) automatable).getSendChannel());
                    } else {
                        effectMenu.setText("ERROR");
                    }

                    postMenu.add(effectMenu);

                    for (Parameter param : params.sorted()) {
                        JMenuItem paramItem = new JMenuItem();
                        paramItem.setText(param.getName());
                        paramItem.addActionListener(parameterActionListener);

                        if (param.isAutomationEnabled()) {
                            if (paramIdList.contains(param.getUniqueId())) {
                                paramItem.setForeground(Color.GREEN);
                            } else {
                                paramItem.setForeground(Color.ORANGE);
                            }

                        }

                        paramItem.putClientProperty("param", param);

                        effectMenu.add(paramItem);
                    }
                }
            }
        }

        return retVal;
    }

    public void parameterAdded(Parameter param) {
        allParameters.add(param);
    }

    public void parameterRemoved(Parameter param) {
        allParameters.remove(param);

        for (LayerGroup<? extends Layer> layerGroup : score) {

            if (layerGroup instanceof PolyObject) {
                PolyObject pObj = (PolyObject) layerGroup;

                for (SoundLayer layer : pObj) {
                    ParameterIdList automationParameters = layer.getAutomationParameters();

                    String paramId = param.getUniqueId();

                    if (automationParameters.contains(paramId)) {
                        automationParameters.removeParameterId(paramId);
                    }
                }
            }
        }

        // dirty = true;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public void automatableAdded(Automatable automatable) {
        ParameterList params = automatable.getParameterList();
        params.addListener(parameterListListener);

        allParameters.addAll(params);
        // dirty = true;
    }

    @Override
    public void automatableRemoved(Automatable automatable) {
        ParameterList params = automatable.getParameterList();
        params.removeListener(parameterListListener);

        ArrayList<String> removedParamIds = new ArrayList<>();

        allParameters.removeAll(params);

        for (int i = 0; i < params.size(); i++) {
            Parameter param = params.get(i);
            removedParamIds.add(param.getUniqueId());
        }

        removeParameters(removedParamIds);
        // dirty = true;
    }

    public Parameter getParameter(String paramId) {
        if (data == null) {
            return null;
        }

        for (Parameter param : allParameters) {
            if (param.getUniqueId().equals(paramId)) {
                return param;
            }
        }
        return null;
    }

    @Override
    public void listChanged(ObservableListEvent<Channel> listEvent) {
        switch (listEvent.getType()) {
            case ObservableListEvent.DATA_ADDED:
                for (Channel channel : listEvent.getAffectedItems()) {
                    channelAdded(channel);
                }
                break;
            case ObservableListEvent.DATA_REMOVED:
                for (Channel channel : listEvent.getAffectedItems()) {
                    channelRemoved(channel);
                }
                break;
        }
    }

    public void channelAdded(Channel channel) {
        addListenerToChannel(channel);
        // dirty = true;
    }

    /*
     * Remove all parameters, clear them from SoundLayers
     */
    public void channelRemoved(Channel channel) {
        EffectsChain pre = channel.getPreEffects();
        pre.removeAutomatableCollectionListener(this);

        ArrayList<String> removedParamIds = new ArrayList<>();

        for (int i = 0; i < pre.size(); i++) {
            ParameterList parameterList = ((Automatable) pre.getElementAt(i)).getParameterList();
            parameterList.removeListener(parameterListListener);
            allParameters.removeAll(parameterList);

            for (int j = 0; j < parameterList.size(); j++) {
                Parameter parameter = parameterList.get(j);
                if (parameter.isAutomationEnabled()) {
                    removedParamIds.add(parameter.getUniqueId());
                }
            }
        }

        EffectsChain post = channel.getPostEffects();
        post.removeAutomatableCollectionListener(this);
        for (int i = 0; i < post.size(); i++) {
            ParameterList parameterList = ((Automatable) post.getElementAt(i)).getParameterList();
            parameterList.removeListener(parameterListListener);
            allParameters.removeAll(parameterList);

            for (int j = 0; j < parameterList.size(); j++) {
                Parameter parameter = parameterList.get(j);
                if (parameter.isAutomationEnabled()) {
                    removedParamIds.add(parameter.getUniqueId());
                }
            }
        }

        Parameter levelParameter = channel.getLevelParameter();

        allParameters.remove(levelParameter);
        if (levelParameter.isAutomationEnabled()) {
            removedParamIds.add(levelParameter.getUniqueId());
        }

        removeParameters(removedParamIds);

        // dirty = true;
    }

    private void removeParameters(ArrayList<String> paramIds) {
        if (paramIds == null || paramIds.isEmpty()) {
            return;
        }

        for (LayerGroup<? extends Layer> layerGroup : score) {

            if (layerGroup instanceof PolyObject) {
                PolyObject pObj = (PolyObject) layerGroup;

                for (SoundLayer layer : pObj) {
                    ParameterIdList automationParameters = layer.getAutomationParameters();

                    for (int k = automationParameters.size() - 1; k >= 0; k--) {
                        String paramId = automationParameters.getParameterId(k);

                        if (paramIds.contains(paramId)) {
                            automationParameters.removeParameterId(k);
                        }
                    }
                }
            }
        }
    }

    protected void updateValuesFromAutomations() {
        Iterator<Parameter> iter = allParameters.iterator();

        while (iter.hasNext()) {
            Parameter param = iter.next();
            if (param.isAutomationEnabled()) {
                param.fireUpdateFromTimeChange();
            }
        }
    }

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        if (event.getType() != LayerGroupDataEvent.DATA_REMOVED
                || !(event.getSource() instanceof PolyObject)) {
            return;
        }

        final ArrayList<Layer> layers = event.getLayers();

        if (layers == null) {
            return;
        }

        for (Layer layer : layers) {
            SoundLayer sLayer = (SoundLayer) layer;

            ParameterIdList idList = sLayer.getAutomationParameters();

            for (int i = 0; i < idList.size(); i++) {
                String paramId = idList.getParameterId(i);

                Parameter param = getParameter(paramId);

                if (param != null) {
                    param.setAutomationEnabled(false);
                }
            }

        }
    }

}
