/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
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
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.logging.Logger;
import javax.swing.JScrollPane;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
//import org.openide.util.Utilities;

/**
 * Top component which displays something.
 */
final class MixerTopComponent extends TopComponent
        implements ArrangementListener {

    private static MixerTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "MixerTopComponent";

    // DATA
    private Mixer mixer;

    private Arrangement arrangement;

    private MixerTopComponent() {
        initComponents();

        ((JScrollPane) jSplitPane1.getLeftComponent()).setBorder(null);
        ((JScrollPane) jSplitPane1.getRightComponent()).setBorder(null);

        setName(NbBundle.getMessage(MixerTopComponent.class, "CTL_MixerTopComponent"));
        setToolTipText(NbBundle.getMessage(MixerTopComponent.class, "HINT_MixerTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();
    }

    protected void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData data = null;
        if (project != null) {
            data = project.getData();

            setMixer(data.getMixer());
            setArrangement(data.getArrangement());
        }
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
            extraRenderText.setText(Float.toString(mixer.getExtraRenderTime()));
        }
    }

    public void setMixer(Mixer mixer) {
        this.mixer = null;

        enabled.setSelected(mixer.isEnabled());
        extraRenderText.setEnabled(mixer.isEnabled());

        extraRenderText.setText(Float.toString(mixer.getExtraRenderTime()));

        channelsPanel.setChannelList(mixer.getChannels(), mixer.getSubChannels());
        subChannelsPanel.setChannelList(mixer.getSubChannels());

        masterPanel.clear();
        masterPanel.setChannel(mixer.getMaster());

        this.mixer = mixer;

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
                Channel channel = channels.getChannel(i);

                if (channel.getName().equals(oldId)) {
                    channel.setName(newId);
                    break;
                }
            }
        } else if (oldIdCount == 0 && newIdCount > 1) {
            // remove old channel, use current channel for newId
            for (int i = 0; i < channels.size(); i++) {
                Channel channel = channels.getChannel(i);

                if (channel.getName().equals(oldId)) {
                    channels.removeChannel(channel);
                    break;
                }
            }
        } else if (oldIdCount > 0 && newIdCount == 1) {
            // create new channel
            Channel channel = new Channel();
            channel.setName(newId);
            channels.addChannel(channel);
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

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jScrollPane3 = new javax.swing.JScrollPane();
        jPanel1 = new javax.swing.JPanel();
        enabled = new javax.swing.JCheckBox();
        jLabel1 = new javax.swing.JLabel();
        extraRenderText = new javax.swing.JTextField();
        masterPanel = new blue.ui.core.mixer.ChannelPanel();
        jSplitPane1 = new javax.swing.JSplitPane();
        jScrollPane1 = new javax.swing.JScrollPane();
        channelsPanel = new blue.ui.core.mixer.ChannelListPanel();
        jScrollPane2 = new javax.swing.JScrollPane();
        subChannelsPanel = new blue.ui.core.mixer.SubChannelListPanel();

        jScrollPane3.setBorder(null);

        org.openide.awt.Mnemonics.setLocalizedText(enabled, org.openide.util.NbBundle.getMessage(MixerTopComponent.class, "MixerTopComponent.enabled.text")); // NOI18N
        enabled.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                enabledActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel1, org.openide.util.NbBundle.getMessage(MixerTopComponent.class, "MixerTopComponent.jLabel1.text")); // NOI18N

        extraRenderText.setText(org.openide.util.NbBundle.getMessage(MixerTopComponent.class, "MixerTopComponent.extraRenderText.text")); // NOI18N
        extraRenderText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                extraRenderTextActionPerformed(evt);
            }
        });
        extraRenderText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                extraRenderTextFocusLost(evt);
            }
        });

        masterPanel.setBorder(null);
        masterPanel.setMaster(true);

        jSplitPane1.setDividerLocation(400);

        jScrollPane1.setViewportView(channelsPanel);

        jSplitPane1.setLeftComponent(jScrollPane1);

        jScrollPane2.setViewportView(subChannelsPanel);

        jSplitPane1.setRightComponent(jScrollPane2);

        javax.swing.GroupLayout jPanel1Layout = new javax.swing.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel1Layout.createSequentialGroup()
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                    .addGroup(jPanel1Layout.createSequentialGroup()
                        .addContainerGap()
                        .addComponent(enabled)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED, 539, Short.MAX_VALUE)
                        .addComponent(jLabel1))
                    .addComponent(jSplitPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 755, Short.MAX_VALUE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING, false)
                    .addComponent(extraRenderText)
                    .addComponent(masterPanel, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
                .addContainerGap())
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(extraRenderText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(jLabel1)
                    .addComponent(enabled))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addGroup(jPanel1Layout.createSequentialGroup()
                        .addComponent(jSplitPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 412, Short.MAX_VALUE)
                        .addGap(0, 0, 0))
                    .addGroup(jPanel1Layout.createSequentialGroup()
                        .addComponent(masterPanel, javax.swing.GroupLayout.DEFAULT_SIZE, 392, Short.MAX_VALUE)
                        .addContainerGap())))
        );

        jScrollPane3.setViewportView(jPanel1);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane3, javax.swing.GroupLayout.DEFAULT_SIZE, 838, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane3, javax.swing.GroupLayout.DEFAULT_SIZE, 440, Short.MAX_VALUE)
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
    private blue.ui.core.mixer.ChannelListPanel channelsPanel;
    private javax.swing.JCheckBox enabled;
    private javax.swing.JTextField extraRenderText;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JScrollPane jScrollPane3;
    private javax.swing.JSplitPane jSplitPane1;
    private blue.ui.core.mixer.ChannelPanel masterPanel;
    private blue.ui.core.mixer.SubChannelListPanel subChannelsPanel;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized MixerTopComponent getDefault() {
        if (instance == null) {
            instance = new MixerTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the MixerTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized MixerTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(MixerTopComponent.class.getName()).warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof MixerTopComponent) {
            return (MixerTopComponent) win;
        }
        Logger.getLogger(MixerTopComponent.class.getName()).warning(
                "There seem to be multiple components with the '" + PREFERRED_ID +
                "' ID. That is a potential source of errors and unexpected behavior.");
        return getDefault();
    }

    @Override
    public int getPersistenceType() {
        return TopComponent.PERSISTENCE_ALWAYS;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    /** replaces this in object stream */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper(jSplitPane1.getDividerLocation());
    }

    @Override
    protected String preferredID() {
        return PREFERRED_ID;
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
