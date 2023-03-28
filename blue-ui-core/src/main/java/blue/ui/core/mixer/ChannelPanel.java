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
package blue.ui.core.mixer;

import blue.BlueSystem;
import blue.mixer.*;
import blue.ui.utilities.UiUtilities;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.MessageFormat;
import java.util.Locale;
import javax.swing.ComboBoxModel;
import javax.swing.DefaultListCellRenderer;
import javax.swing.DefaultListModel;
import javax.swing.JList;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.windows.WindowManager;

/**
 *
 * @author Steven Yi
 * @author Michael Bechard
 */
public class ChannelPanel extends javax.swing.JPanel implements
        PropertyChangeListener, Comparable<ChannelPanel> {

    boolean subChannel = false;

    boolean updating = false;

    /**
     * Creates new form ChannelPanel
     */
    public ChannelPanel() {
        initComponents();

        levelLabel.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() >= 2) {
                    switchLevelValueView(true);
                    levelValueField.requestFocus();
                }
            }
        });

        levelValueField.addActionListener((ActionEvent e) -> {
            setLevelValueFromField();
            switchLevelValueView(false);
        });

        levelValueField.addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                switchLevelValueView(false);
            }
        });

        Dimension miniScrollDim = new Dimension(9, 55);

        preScroll.getVerticalScrollBar().setPreferredSize(miniScrollDim);
        postScroll.getVerticalScrollBar().setPreferredSize(miniScrollDim);

        miniScrollDim = new Dimension(1, 9);

        preScroll.getHorizontalScrollBar().setPreferredSize(miniScrollDim);
        postScroll.getHorizontalScrollBar().setPreferredSize(miniScrollDim);

        levelSlider.addChangeListener((ChangeEvent e) -> {
            if (!updating) {
                updateLevelValue();
            }
        });

        outputList.addActionListener((ActionEvent arg0) -> {
            if (channel != null) {
                channel
                        .setOutChannel((String) outputList
                                .getSelectedItem());
            }
        });

        preList.setCellRenderer(new EnabledListCellRenderer());
        postList.setCellRenderer(new EnabledListCellRenderer());
    }

    private void setLevelValueFromField() {
        try {
            float val = Float.parseFloat(levelValueField.getText());

            //validate the value
            val = Math.max(val, -96.0f);
            val = Math.min(val, 12.0f);

            //set widgets
            channel.setLevel(val);
//            levelSlider.setValue(getSliderValFromChannel());
//            levelLabel.setText(channel.getLevel() + " dB");
        } catch (NumberFormatException ex) {
        }
    }

    private void switchLevelValueView(boolean toTextField) {
        String compName;

        if (toTextField) {
            compName = "levelField";
            MessageFormat fmt = new MessageFormat("{0,number,##.####}",
                    Locale.ENGLISH);
            levelValueField.setText(fmt.format(new Object[]{new Float(
                channel.getLevel())}));
            //levelValueField.setText(NumberUtilities.formatFloat(channel.getLevel()));
        } else {
            compName = "levelLabel";
            levelLabel.setText(channel.getLevel() + " dB");
        }

        //switch components
        CardLayout cardLayout = (CardLayout) levelValuePanel.getLayout();
        cardLayout.show(levelValuePanel, compName);
    }

    public Channel getChannel() {
        return this.channel;
    }

    public synchronized void setChannel(Channel channel) {
        if (this.channel != null) {
            this.channel.removePropertyChangeListener(this);
        }

        this.channel = null;

        preList.setModel(channel.getPreEffects());
        postList.setModel(channel.getPostEffects());

        channelNameLabel.setText(channel.getName());
        channelNameLabel.setToolTipText(channel.getName());
        outputList.setSelectedItem(channel.getOutChannel());

        int levelVal = getSliderValFromChannel(channel);

        levelSlider.setValue(levelVal);
        levelLabel.setText(channel.getLevel() + " dB");

        this.channel = channel;

        this.channel.addPropertyChangeListener(this);
    }

    private int getSliderValFromChannel(Channel channel) {
        int levelVal = 0;

        if (channel != null) {
            if (channel.getLevel() > 0) {
                levelVal = (int) (channel.getLevel() * 20);
            } else {
                levelVal = (int) (channel.getLevel() * 10);
            }
        }

        return levelVal;
    }

    public void setSubChannel(boolean val) {
        subChannel = val;
    }

    public void setChannelOutModel(ComboBoxModel model) {
        this.outputList.setModel(model);
    }

    public ComboBoxModel getChannelOutModel() {
        return this.outputList.getModel();
    }

    public synchronized void clear() {
        if (this.channel != null) {
            this.channel.removePropertyChangeListener(this);
        }

        DefaultListModel fakeModel = new DefaultListModel();
        fakeModel.addElement("clear");

        preList.setModel(fakeModel);
        postList.setModel(fakeModel);

        ComboBoxModel model = this.outputList.getModel();
        if (model instanceof ChannelOutComboBoxModel) {
            ((ChannelOutComboBoxModel) model).clearListeners();
        }
    }

    public boolean isMaster() {
        return master;
    }

    public void setMaster(boolean master) {
        this.master = master;

        outputLabel.setVisible(!master);
        outputList.setVisible(!master);
    }

    private void updateLevelValue() {
        if (this.channel == null) {
            return;
        }

        float db = levelSlider.getValue();

        db = db > 0 ? db / 20 : db / 10;

        channel.setLevel(db);

        levelLabel.setText(db + " dB");
        // System.out.println("Scaling Factor: " + db + " : "+
        // MusicFunctions.ampdb(db));
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jLabel1 = new javax.swing.JLabel();
        levelSlider = new javax.swing.JSlider();
        channelNameLabel = new javax.swing.JLabel();
        preLabel = new javax.swing.JLabel();
        postLabel = new javax.swing.JLabel();
        outputLabel = new javax.swing.JLabel();
        outputList = new javax.swing.JComboBox();
        postScroll = new javax.swing.JScrollPane();
        postList = new javax.swing.JList();
        preScroll = new javax.swing.JScrollPane();
        preList = new javax.swing.JList();
        levelValuePanel = new javax.swing.JPanel();
        levelLabel = new javax.swing.JLabel();
        levelValueField = new javax.swing.JTextField();

        setBorder(javax.swing.BorderFactory.createBevelBorder(javax.swing.border.BevelBorder.RAISED));

        jLabel1.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        jLabel1.setText("Level");

        levelSlider.setMaximum(240);
        levelSlider.setMinimum(-960);
        levelSlider.setOrientation(javax.swing.JSlider.VERTICAL);
        levelSlider.setValue(0);
        levelSlider.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                levelSliderMouseClicked(evt);
            }
        });

        channelNameLabel.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        channelNameLabel.setText("Channel");
        channelNameLabel.setBorder(javax.swing.BorderFactory.createBevelBorder(javax.swing.border.BevelBorder.LOWERED));
        channelNameLabel.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                channelNameLabelMouseClicked(evt);
            }
        });

        preLabel.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        preLabel.setText("Pre");

        postLabel.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        postLabel.setText("Post");

        outputLabel.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        outputLabel.setText("Output");

        outputList.setFont(new java.awt.Font("Dialog", 0, 10)); // NOI18N
        outputList.setModel(new javax.swing.DefaultComboBoxModel(new String[] { "Item 1", "Item 2", "Item 3", "Item 4" }));
        outputList.setFocusable(false);

        postList.setFont(new java.awt.Font("Dialog", 0, 10)); // NOI18N
        postList.setModel(new javax.swing.AbstractListModel() {
            String[] strings = { "Item 1", "Item 2", "Item 3", "Item 4", "Item 5" };
            public int getSize() { return strings.length; }
            public Object getElementAt(int i) { return strings[i]; }
        });
        postList.setSelectionMode(javax.swing.ListSelectionModel.SINGLE_SELECTION);
        postList.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                postListMouseClicked(evt);
            }
        });
        postScroll.setViewportView(postList);

        preList.setFont(new java.awt.Font("Dialog", 0, 10)); // NOI18N
        preList.setModel(new javax.swing.AbstractListModel() {
            String[] strings = { "Item 1", "Item 2", "Item 3", "Item 4", "Item 5" };
            public int getSize() { return strings.length; }
            public Object getElementAt(int i) { return strings[i]; }
        });
        preList.setSelectionMode(javax.swing.ListSelectionModel.SINGLE_SELECTION);
        preList.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                preListFocusLost(evt);
            }
        });
        preList.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                preListMouseClicked(evt);
            }
        });
        preScroll.setViewportView(preList);

        levelValuePanel.setMaximumSize(new java.awt.Dimension(24, 20));
        levelValuePanel.setMinimumSize(new java.awt.Dimension(24, 20));
        levelValuePanel.setPreferredSize(new java.awt.Dimension(24, 20));
        levelValuePanel.setLayout(new java.awt.CardLayout());

        levelLabel.setHorizontalAlignment(javax.swing.SwingConstants.CENTER);
        levelLabel.setText("0db");
        levelLabel.setBorder(new javax.swing.border.SoftBevelBorder(javax.swing.border.BevelBorder.LOWERED));
        levelLabel.setName("levelLabel"); // NOI18N
        levelValuePanel.add(levelLabel, "levelLabel");

        levelValueField.setBorder(javax.swing.BorderFactory.createLineBorder(java.awt.Color.green));
        levelValueField.setMargin(new java.awt.Insets(0, 2, 0, 2));
        levelValueField.setName("levelField"); // NOI18N
        levelValuePanel.add(levelValueField, "levelField");

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(channelNameLabel, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(preLabel, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(preScroll, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(jLabel1, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(outputList, 0, 86, Short.MAX_VALUE)
            .addComponent(outputLabel, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(postScroll, javax.swing.GroupLayout.Alignment.TRAILING, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(postLabel, javax.swing.GroupLayout.Alignment.TRAILING, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(levelValuePanel, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
            .addComponent(levelSlider, javax.swing.GroupLayout.Alignment.TRAILING, javax.swing.GroupLayout.DEFAULT_SIZE, 86, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                .addComponent(channelNameLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(preLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(preScroll, javax.swing.GroupLayout.PREFERRED_SIZE, 50, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jLabel1)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(levelSlider, javax.swing.GroupLayout.DEFAULT_SIZE, 56, Short.MAX_VALUE)
                .addGap(3, 3, 3)
                .addComponent(levelValuePanel, javax.swing.GroupLayout.PREFERRED_SIZE, 16, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(postLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(postScroll, javax.swing.GroupLayout.PREFERRED_SIZE, 50, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(outputLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(outputList, javax.swing.GroupLayout.PREFERRED_SIZE, 28, javax.swing.GroupLayout.PREFERRED_SIZE))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void levelSliderMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_levelSliderMouseClicked
        if(evt.getClickCount() == 2) {
            channel.setLevel(0.0);
        }

    }//GEN-LAST:event_levelSliderMouseClicked

    private void preListFocusLost(java.awt.event.FocusEvent evt) {// GEN-FIRST:event_preListFocusLost
        preList.setSelectedIndex(-1);
    }// GEN-LAST:event_preListFocusLost

    private void postListMouseClicked(java.awt.event.MouseEvent evt) {// GEN-FIRST:event_postListMouseClicked
        if (UiUtilities.isRightMouseButton(evt)) {

            int index = postList.locationToIndex(evt.getPoint());
            if(postList.getSelectedIndex() != index) {
                postList.setSelectedIndex(index);
            }

            EffectsPopup popup = EffectsPopup.getInstance();
            popup.setEffectsChain(this.channel.getPostEffects(), postList
                    .getSelectedIndex());
            popup.setComboBoxModel(outputList.getModel());
            popup.setMaster(isMaster());
            popup.setListSelectionModel(postList.getSelectionModel());

            popup.show(postList, evt.getX(), evt.getY());
        } else if (SwingUtilities.isLeftMouseButton(evt)
                && evt.getClickCount() == 2) {
            if (postList.getSelectedValue() == null) {
                return;
            }

            Object obj = postList.getSelectedValue();

            Frame root = WindowManager.getDefault().getMainWindow();

            if (obj instanceof Effect) {
                Effect effect = (Effect) obj;

                EffectEditorManager.getInstance()
                        .openEffectEditor(root, effect);
            } else if (obj instanceof Send) {
                Send send = (Send) obj;

                ComboBoxModel model = outputList.getModel();
                ComboBoxModel temp = null;

                if (model instanceof ChannelOutComboBoxModel) {
                    temp = ((ChannelOutComboBoxModel) model).getCopy();
                } else if (model instanceof SubChannelOutComboBoxModel) {
                    temp = ((SubChannelOutComboBoxModel) model).getCopy();
                }

                SendEditorManager.getInstance()
                        .openSendEditor(root, send, temp);
            }

        }
    }// GEN-LAST:event_postListMouseClicked

    private void preListMouseClicked(java.awt.event.MouseEvent evt) {// GEN-FIRST:event_preListMouseClicked

        if (UiUtilities.isRightMouseButton(evt)) {

            int index = preList.locationToIndex(evt.getPoint());
            if(preList.getSelectedIndex() != index) {
                preList.setSelectedIndex(index);
            }

            EffectsPopup popup = EffectsPopup.getInstance();
            popup.setEffectsChain(this.channel.getPreEffects(), preList
                    .getSelectedIndex());
            popup.setComboBoxModel(outputList.getModel());
            popup.setMaster(isMaster());
            popup.setListSelectionModel(preList.getSelectionModel());

            popup.show(preList, evt.getX(), evt.getY());
        } else if (SwingUtilities.isLeftMouseButton(evt)
                && evt.getClickCount() == 2) {
            if (preList.getSelectedValue() == null) {
                return;
            }

            Object obj = preList.getSelectedValue();

            Frame root = WindowManager.getDefault().getMainWindow();

            if (obj instanceof Effect) {
                Effect effect = (Effect) obj;

                EffectEditorManager.getInstance()
                        .openEffectEditor(root, effect);
            } else if (obj instanceof Send) {
                Send send = (Send) obj;

                ComboBoxModel model = outputList.getModel();
                ComboBoxModel temp = null;

                if (model instanceof ChannelOutComboBoxModel) {
                    temp = ((ChannelOutComboBoxModel) model).getCopy();
                } else if (model instanceof SubChannelOutComboBoxModel) {
                    temp = ((SubChannelOutComboBoxModel) model).getCopy();
                }

                SendEditorManager.getInstance()
                        .openSendEditor(root, send, temp);

            } else {
                System.err.println("ERR: " + obj);
            }
        }
    }// GEN-LAST:event_preListMouseClicked

    private void channelNameLabelMouseClicked(java.awt.event.MouseEvent evt) {// GEN-FIRST:event_channelNameLabelMouseClicked
        if (evt.getClickCount() == 2
                && (subChannel || channel.getAssociation() != null)) {
            editChannelName();
        }
    }// GEN-LAST:event_channelNameLabelMouseClicked

    private void editSubChannelName() {
        boolean finished = false;
        String originalName = channel.getName();

        SubChannelOutComboBoxModel model = (SubChannelOutComboBoxModel) getChannelOutModel();
        ChannelList subChannels = model.getChannels();

        while (!finished) {

            String retVal = JOptionPane.showInputDialog(
                    WindowManager.getDefault().getMainWindow(),
                    "Please Enter SubChannel Name", originalName);

            if (retVal != null && retVal.trim().length() > 0
                    && !retVal.equals(originalName)) {
                retVal = retVal.trim();

                if (!isValidChannelName(retVal)) {
                    JOptionPane.showMessageDialog(this,
                            "Error: Channel names may only contain letters, "
                            + "numbers, or underscores", BlueSystem
                            .getString("common.error"),
                            JOptionPane.ERROR_MESSAGE);
                    finished = false;
                } else if (retVal.equals(Channel.MASTER)
                        || subChannels.isChannelNameInUse(retVal)) {
                    JOptionPane.showMessageDialog(this,
                            "Error: Channel Name already in use", BlueSystem
                            .getString("common.error"),
                            JOptionPane.ERROR_MESSAGE);
                    finished = false;
                } else {
                    channel.setName(retVal);
                    finished = true;
                }

            } else {
                finished = true;
            }
        }
    }

    /**
     *
     */
    private void editChannelName() {
        if (subChannel) {
            editSubChannelName();
        } else {
            String originalName = channel.getName();
            String retVal = JOptionPane.showInputDialog(
                    WindowManager.getDefault().getMainWindow(),
                    "Please Enter Channel Name", originalName);

            if (retVal != null && retVal.trim().length() > 0
                    && !retVal.equals(originalName)) {
                retVal = retVal.trim();
                channel.setName(retVal);
            }
        }
    }

    private boolean isValidChannelName(String retVal) {
        for (int i = 0; i < retVal.length(); i++) {
            char c = retVal.charAt(i);
            if (!(Character.isLetterOrDigit(c) || c == '_')) {
                return false;
            }
        }
        return true;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() != this.channel) {
            return;
        }

        String prop = evt.getPropertyName();
        switch (prop) {
            case Channel.NAME:
                channelNameLabel.setText(channel.getName());
                channelNameLabel.setToolTipText(channel.getName());
                channelNameLabel.invalidate();
                channelNameLabel.repaint();
                break;
            case Channel.LEVEL:
                updating = true;
                int levelVal = 0;
                if (channel.getLevel() > 0) {
                    levelVal = (int) (channel.getLevel() * 20);
                } else {
                    levelVal = (int) (channel.getLevel() * 10);
                }
                levelSlider.setValue(levelVal);
                levelLabel.setText(channel.getLevel() + " dB");
                levelLabel.invalidate();
                levelLabel.repaint();
                updating = false;
                break;
        }
    }

    @Override
    public int compareTo(ChannelPanel chanB) {
        try {
            int a = Integer.parseInt(this.channel.getName());
            int b = Integer.parseInt(chanB.getChannel().getName());

            return a - b;

        } catch (NumberFormatException nfe) {
            return (this.channel.getName()).compareToIgnoreCase(chanB
                    .getChannel().getName());
        }
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JLabel channelNameLabel;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel levelLabel;
    private javax.swing.JSlider levelSlider;
    private javax.swing.JTextField levelValueField;
    private javax.swing.JPanel levelValuePanel;
    private javax.swing.JLabel outputLabel;
    private javax.swing.JComboBox outputList;
    private javax.swing.JLabel postLabel;
    private javax.swing.JList postList;
    private javax.swing.JScrollPane postScroll;
    private javax.swing.JLabel preLabel;
    private javax.swing.JList preList;
    private javax.swing.JScrollPane preScroll;
    // End of variables declaration//GEN-END:variables

    private Channel channel;

    private boolean master;

    private static class EnabledListCellRenderer extends
            DefaultListCellRenderer {

        private final Font ENABLED_FONT = new java.awt.Font("Dialog", 0, 10);

        private final Font DISABLED_FONT = new java.awt.Font("Dialog",
                Font.ITALIC, 10);

        private static final Color ENABLED_COLOR = Color.WHITE;

        private static final Color DISABLED_COLOR = Color.GRAY;

        public EnabledListCellRenderer() {

        }

        @Override
        public Component getListCellRendererComponent(JList list, Object value,
                int index, boolean isSelected, boolean cellHasFocus) {

            Component c = super.getListCellRendererComponent(list, value,
                    index, isSelected, cellHasFocus);

            if (list.getModel() != null && index >= 0) {
                if (list.getModel() instanceof EffectsChain) {

                    EffectsChain chain = (EffectsChain) list.getModel();

                    Object obj = chain.getElementAt(index);

                    if (obj instanceof Effect) {
                        Effect effect = (Effect) obj;

                        if (effect.isEnabled()) {
                            c.setForeground(ENABLED_COLOR);
                        } else {
                            c.setForeground(DISABLED_COLOR);
                        }
                    } else {
                        Send send = (Send) obj;

                        if (send.isEnabled()) {
                            c.setForeground(ENABLED_COLOR);
                        } else {
                            c.setForeground(DISABLED_COLOR);
                        }
                    }
                }
            }

            return c;
        }

        // public void paintComponent(Graphics g) {
        // Graphics2D g2d = (Graphics2D) g;
        // g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
        // RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        //
        // super.paintComponent(g2d);
        // }
    }
}
