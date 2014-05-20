/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.mixer;

import blue.Arrangement;
import blue.ArrangementEvent;
import blue.ArrangementListener;
import blue.BlueData;
import blue.mixer.Channel;
import blue.mixer.ChannelList;
import blue.mixer.Mixer;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import java.awt.Component;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
//import org.openide.util.Utilities;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(dtd = "-//blue.ui.core.mixer//Mixer//EN",
        autostore = false)
@TopComponent.Description(
        preferredID = "MixerTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "output", openAtStartup = false,
        position = 200)
@ActionID(category = "Window", id = "blue.ui.core.mixer.MixerTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 600),
    @ActionReference(path = "Shortcuts", name = "S-F5")
})

@TopComponent.OpenActionRegistration(
        displayName = "#CTL_MixerAction",
        preferredID = "MixerTopComponent"
)
@NbBundle.Messages({
    "CTL_MixerAction=Mixer",
    "CTL_MixerTopComponent=Mixer",
    "HINT_MixerTopComponent=This is a Mixer window"
})

public final class MixerTopComponent extends TopComponent
        implements ArrangementListener {

    private static MixerTopComponent instance;

    // DATA
    private Mixer mixer;

    private Arrangement arrangement;

    private Integer dividerLocationReset;
    private final ObservableListListener<ChannelList> listChangeListener;

    private MixerTopComponent() {
        initComponents();

        ((JScrollPane) jSplitPane1.getLeftComponent()).setBorder(null);
        ((JScrollPane) jSplitPane1.getRightComponent()).setBorder(null);

        setName(NbBundle.getMessage(MixerTopComponent.class,
                "CTL_MixerTopComponent"));
        setToolTipText(NbBundle.getMessage(MixerTopComponent.class,
                "HINT_MixerTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

        BlueProjectManager.getInstance().addPropertyChangeListener(
                new PropertyChangeListener() {

                    @Override
                    public void propertyChange(PropertyChangeEvent evt) {
                        if (BlueProjectManager.CURRENT_PROJECT.equals(
                                evt.getPropertyName())) {
                            SwingUtilities.invokeLater(new Runnable() {

                                @Override
                                public void run() {
                                    reinitialize();
                                }
                            });
                        }
                    }
                });

        jSplitPane1.addComponentListener(new ComponentListener() {

            @Override
            public void componentResized(ComponentEvent e) {
            }

            @Override
            public void componentMoved(ComponentEvent e) {
            }

            @Override
            public void componentShown(ComponentEvent e) {
                if (dividerLocationReset != null) {
                    jSplitPane1.setLastDividerLocation(dividerLocationReset);
                    jSplitPane1.setDividerLocation(dividerLocationReset);
                    dividerLocationReset = null;
                }
            }

            @Override
            public void componentHidden(ComponentEvent e) {
            }
        });

        channelGroupsPanel.setLayout(new ChannelListLayout());

        this.listChangeListener = new ObservableListListener<ChannelList>() {

            @Override
            public void listChanged(ObservableListEvent<ChannelList> listEvent) {
                int index = listEvent.getStartIndex();
                int index2 = listEvent.getEndIndex();

                switch (listEvent.getType()) {
                    case ObservableListEvent.DATA_ADDED:

                        for (ChannelList list : listEvent.getAffectedItems()) {
                            ChannelListPanel panel = new ChannelListPanel();
                            channelGroupsPanel.add(panel, index);

                            panel.setChannelList(list,
                                    mixer.getSubChannels());
                            panel.revalidate();
                            index++;
                        }
                        break;
                    case ObservableListEvent.DATA_REMOVED:
                        for (int i = 0; i <= index2 - index2; i++) {
                            channelGroupsPanel.remove(index);
                        }
                        break;
                    case ObservableListEvent.DATA_CHANGED:
                        reinitialize();
                        break;
                }
            }

        };

        reinitialize();
    }

    protected void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData data = null;

        channelGroupsPanel.removeAll();

        if (project != null) {
            data = project.getData();

            for (ChannelList list : data.getMixer().getChannelListGroups()) {
                ChannelListPanel panel = new ChannelListPanel();
                channelGroupsPanel.add(panel);

                panel.setChannelList(list, data.getMixer().getSubChannels());
                panel.revalidate();
            }

            channelGroupsPanel.add(channelsPanel);

            setMixer(data.getMixer());
            setArrangement(data.getArrangement());
        }

        channelGroupsPanel.revalidate();
        channelGroupsPanel.repaint();
    }

    protected void updateExtraRenderValue() {
        String val = extraRenderText.getText();

        try {
            float value = Float.parseFloat(val);

            if (value < 0.0f) {
                value = 0.0f;
            }

            mixer.setExtraRenderTime(value);
        } catch (NumberFormatException nfe) {
            extraRenderText.setText(Float.toString(
                    mixer.getExtraRenderTime()));
        }
    }

    public void setMixer(Mixer mixer) {

        if (this.mixer != null) {
            this.mixer.getChannelListGroups().removeListener(listChangeListener);
        }

        this.mixer = null;

        enabled.setSelected(mixer.isEnabled());
        extraRenderText.setEnabled(mixer.isEnabled());

        extraRenderText.setText(Float.toString(mixer.getExtraRenderTime()));

        channelsPanel.setChannelList(mixer.getChannels(),
                mixer.getSubChannels());
        subChannelsPanel.setChannelList(mixer.getSubChannels());

        masterPanel.clear();
        masterPanel.setChannel(mixer.getMaster());

        this.mixer = mixer;

        this.mixer.getChannelListGroups().addListener(listChangeListener);

        EffectEditorManager.getInstance().clear();
        SendEditorManager.getInstance().clear();
    }

    public void setArrangement(Arrangement arrangement) {
        if (this.arrangement != null) {
            arrangement.removeArrangementListener(this);
            this.arrangement = null;
        }

        this.arrangement = arrangement;

        reconcileWithArrangement();

        arrangement.addArrangementListener(this);
    }

    @Override
    public void arrangementChanged(ArrangementEvent arrEvt) {
        switch (arrEvt.getType()) {
            case ArrangementEvent.UPDATE:
                reconcileWithArrangement();
                break;
            case ArrangementEvent.INSTRUMENT_ID_CHANGED:
                switchMixerId(arrEvt.getOldId(), arrEvt.getNewId());
                // reconcileWithArrangement();
                break;

        }
    }

    /**
     * Because blue allows multiple instruments to have the same arrangmentId,
     * must handle cases of if channels exist for oldId and newId, as well as
     * creating or destroying channels
     */
    private void switchMixerId(String oldId, String newId) {
        ChannelList channels = mixer.getChannels();

        int oldIdCount = 0;
        int newIdCount = 0;

        for (int i = 0; i < arrangement.size(); i++) {
            String instrId = arrangement.getInstrumentAssignment(i).arrangementId;

            if (instrId.equals(oldId)) {
                oldIdCount++;
            } else if (instrId.equals(newId)) {
                newIdCount++;
            }
        }

        if (oldIdCount == 0 && newIdCount == 1) {
            // rename old channel
            for (int i = 0; i < channels.size(); i++) {
                Channel channel = channels.get(i);

                if (channel.getName().equals(oldId)) {
                    channel.setName(newId);
                    break;
                }
            }
        } else if (oldIdCount == 0 && newIdCount > 1) {
            // remove old channel, use current channel for newId
            for (int i = 0; i < channels.size(); i++) {
                Channel channel = channels.get(i);

                if (channel.getName().equals(oldId)) {
                    channels.remove(channel);
                    break;
                }
            }
        } else if (oldIdCount > 0 && newIdCount == 1) {
            // create new channel
            Channel channel = new Channel();
            channel.setName(newId);
            channels.add(channel);
        } // else if(oldIdCount > 0 && newIdCount > 1) {
        // do neither, as channels exist for both before and after
        // }

    }

    private void reconcileWithArrangement() {
//        ChannelList channels = mixer.getChannels();
//
//        ArrayList<String> idList = new ArrayList<String>();
//
//        for (int i = 0; i < arrangement.size(); i++) {
//            String instrId = arrangement.getInstrumentAssignment(i).arrangementId;
//
//            if (!idList.contains(instrId)) {
//                idList.add(instrId);
//            }
//        }
//
//        for (int i = channels.size() - 1; i >= 0; i--) {
//            Channel channel = channels.getChannel(i);
//            if (!idList.contains(channel.getName())) {
//                channels.removeChannel(channel);
//            }
//        }
//
//        for (int i = 0; i < idList.size(); i++) {
//            channels.checkOrCreate(idList.get(i));
//        }
//
//        channels.sort();
        channelsPanel.sort();
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        channelsPanel = new blue.ui.core.mixer.ChannelListPanel();
        enabled = new javax.swing.JCheckBox();
        jLabel1 = new javax.swing.JLabel();
        extraRenderText = new javax.swing.JTextField();
        masterPanel = new blue.ui.core.mixer.ChannelPanel();
        jSplitPane1 = new javax.swing.JSplitPane();
        jScrollPane1 = new javax.swing.JScrollPane();
        channelGroupsPanel = new javax.swing.JPanel();
        jScrollPane2 = new javax.swing.JScrollPane();
        subChannelsPanel = new blue.ui.core.mixer.SubChannelListPanel();

        org.openide.awt.Mnemonics.setLocalizedText(enabled, org.openide.util.NbBundle.getMessage(MixerTopComponent.class, "MixerTopComponent.enabled.text")); // NOI18N
        enabled.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                enabledActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel1, org.openide.util.NbBundle.getMessage(MixerTopComponent.class, "MixerTopComponent.jLabel1.text")); // NOI18N

        extraRenderText.setText(org.openide.util.NbBundle.getMessage(MixerTopComponent.class, "MixerTopComponent.extraRenderText.text")); // NOI18N
        extraRenderText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                extraRenderTextFocusLost(evt);
            }
        });
        extraRenderText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                extraRenderTextActionPerformed(evt);
            }
        });

        masterPanel.setBorder(null);
        masterPanel.setMaster(true);

        jSplitPane1.setDividerLocation(400);

        channelGroupsPanel.setLayout(null);
        jScrollPane1.setViewportView(channelGroupsPanel);

        jSplitPane1.setLeftComponent(jScrollPane1);

        jScrollPane2.setViewportView(subChannelsPanel);

        jSplitPane1.setRightComponent(jScrollPane2);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                    .addGroup(layout.createSequentialGroup()
                        .addContainerGap()
                        .addComponent(enabled)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED, 188, Short.MAX_VALUE)
                        .addComponent(jLabel1))
                    .addComponent(jSplitPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 393, Short.MAX_VALUE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING, false)
                    .addComponent(extraRenderText)
                    .addComponent(masterPanel, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(extraRenderText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(jLabel1)
                    .addComponent(enabled))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addGroup(layout.createSequentialGroup()
                        .addComponent(masterPanel, javax.swing.GroupLayout.DEFAULT_SIZE, 293, Short.MAX_VALUE)
                        .addContainerGap())
                    .addComponent(jSplitPane1)))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void enabledActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_enabledActionPerformed
        if (mixer != null) {
            mixer.setEnabled(enabled.isSelected());
            extraRenderText.setEnabled(enabled.isSelected());
        }
}//GEN-LAST:event_enabledActionPerformed

    private void extraRenderTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_extraRenderTextActionPerformed
        updateExtraRenderValue();
    }//GEN-LAST:event_extraRenderTextActionPerformed

    private void extraRenderTextFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_extraRenderTextFocusLost
        updateExtraRenderValue();
    }//GEN-LAST:event_extraRenderTextFocusLost

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JPanel channelGroupsPanel;
    private blue.ui.core.mixer.ChannelListPanel channelsPanel;
    private javax.swing.JCheckBox enabled;
    private javax.swing.JTextField extraRenderText;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JSplitPane jSplitPane1;
    private blue.ui.core.mixer.ChannelPanel masterPanel;
    private blue.ui.core.mixer.SubChannelListPanel subChannelsPanel;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files
     * only, i.e. deserialization routines; otherwise you could get a
     * non-deserialized instance. To obtain the singleton instance, use
     * {@link #findInstance}.
     */
    public static synchronized MixerTopComponent getDefault() {
        if (instance == null) {
            instance = new MixerTopComponent();
        }
        return instance;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
        p.setProperty("dividerLocation",
                Integer.toString(jSplitPane1.getDividerLocation()));
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
        if (p.containsKey("dividerLocation")) {
            dividerLocationReset = Integer.parseInt(p.getProperty(
                    "dividerLocation"));
        }
    }

    /**
     * replaces this in object stream
     */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper(jSplitPane1.getDividerLocation());
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;
        private final int dividerLocation;

        private ResolvableHelper(int dividerLocation) {
            this.dividerLocation = dividerLocation;
        }

        public Object readResolve() {
            MixerTopComponent mtc = MixerTopComponent.getDefault();
            mtc.jSplitPane1.setDividerLocation(dividerLocation);

            return mtc;
        }
    }
}
