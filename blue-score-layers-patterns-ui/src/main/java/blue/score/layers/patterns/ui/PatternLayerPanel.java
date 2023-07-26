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
package blue.score.layers.patterns.ui;

import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.patterns.core.PatternLayer;
import blue.soundObject.SoundObject;
import blue.soundObject.TimeBehavior;
import blue.ui.components.IconFactory;
import blue.ui.core.clipboard.BlueClipboardUtils;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.layers.soundObject.ScoreObjectEditorTopComponent;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JMenuItem;
import javax.swing.border.BevelBorder;
import javax.swing.border.Border;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.Exceptions;
import org.openide.util.lookup.InstanceContent;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class PatternLayerPanel extends javax.swing.JPanel
        implements PropertyChangeListener {

    private final PatternLayer patternLayer;

    private InstanceContent content;

    private static final Border border = BorderFactory.createBevelBorder(
            BevelBorder.RAISED);
    private static final Border selectionBorder = BorderFactory.createBevelBorder(
            BevelBorder.RAISED, Color.GREEN, Color.GREEN.darker());

    /**
     * Creates new form PatternLayerPanel
     */
    public PatternLayerPanel(PatternLayer layer, InstanceContent ic) {
        initComponents();
        Dimension d = new Dimension(100, Layer.LAYER_HEIGHT);
        this.setSize(d);
        this.setPreferredSize(d);
        this.content = ic;

//        
//        addMouseListener(new MouseAdapter() {
//
//            @Override
//            public void mousePressed(MouseEvent e) {
//                if(e.getClickCount() == 1) {
//                    requestFocus();
//                    editSoundObject();
//                    e.consume();
//                }
//            }
//            
//            
//        });
        ActionListener al = new ActionListener() {

            @Override
            @SuppressWarnings("unchecked")
            public void actionPerformed(ActionEvent e) {
                JMenuItem temp = (JMenuItem) e.getSource();
                Class<? extends SoundObject> c = (Class<? extends SoundObject>) temp.getClientProperty("sObjClass");

                try {
                    SoundObject sObj = c.newInstance();
                    patternLayer.setSoundObject(sObj);
                    editSoundObject();
                } catch (InstantiationException ex) {
                    Exceptions.printStackTrace(ex);
                } catch (IllegalAccessException ex) {
                    Exceptions.printStackTrace(ex);
                }

            }

        };

        FileObject sObjFiles[] = FileUtil.getConfigFile(
                "blue/score/layers/patterns/soundObjects").getChildren();
        List<FileObject> orderedSObjFiles = FileUtil.getOrder(
                Arrays.asList(sObjFiles), true);

        for (FileObject fObj : orderedSObjFiles) {

            if (fObj.isFolder()) {
                continue;
            }

            SoundObject sObj = FileUtil.getConfigObject(fObj.getPath(),
                    SoundObject.class);


            String originalFile = (String) fObj.getAttribute("originalFile");
            FileObject configFile = FileUtil.getConfigFile(originalFile);
            if(configFile == null) {
                System.err.println("[PatternLayerPanel] Error: Unable to open file: " +
                        originalFile); 
            } else {
                String displayName = (String)configFile.getAttribute("displayName");
                
                JMenuItem temp = new JMenuItem();
                temp.setText(displayName);
                temp.putClientProperty("sObjClass", sObj.getClass());
                temp.setActionCommand(displayName);
                temp.addActionListener(al);
                changeSObjMenu.add(temp);
            }
        }

        setBorder(border);

        this.patternLayer = layer;

        nameLabel.setText(patternLayer.getName());
        
        muteToggleButton.putClientProperty( "FlatLaf.style", "selectedBackground: #b28c00" );
        soloToggleButton.putClientProperty( "FlatLaf.style", "selectedBackground: #00b200" );
        
        muteToggleButton.setSelected(patternLayer.isMuted());
        soloToggleButton.setSelected(patternLayer.isSolo());

        this.patternLayer.addPropertyChangeListener(this);
        
        muteToggleButton.setFont(muteToggleButton.getFont().deriveFont(10.0f));
        soloToggleButton.setFont(muteToggleButton.getFont().deriveFont(10.0f));
    }

    protected void editSoundObject() {
        content.set(Collections.singleton(patternLayer.getSoundObject()), null);

        ScoreObjectEditorTopComponent editor
                = (ScoreObjectEditorTopComponent) WindowManager
                .getDefault()
                .findTopComponent("ScoreObjectEditorTopComponent");

        if (!editor.isOpened()) {
            editor.open();
        }

        editor.requestActive();
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPopupMenu1 = new javax.swing.JPopupMenu();
        editSObjMenuItem = new javax.swing.JMenuItem();
        jSeparator1 = new javax.swing.JPopupMenu.Separator();
        setSObjFromBufferMenuItem = new javax.swing.JMenuItem();
        copySObjToBufferMenuItem = new javax.swing.JMenuItem();
        jSeparator2 = new javax.swing.JPopupMenu.Separator();
        changeSObjMenu = new javax.swing.JMenu();
        jPanel1 = new javax.swing.JPanel();
        nameLabel = new javax.swing.JLabel();
        nameText = new javax.swing.JTextField();
        muteToggleButton = new javax.swing.JToggleButton();
        soloToggleButton = new javax.swing.JToggleButton();
        otherMenuButton = new javax.swing.JButton();

        editSObjMenuItem.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.editSObjMenuItem.text")); // NOI18N
        editSObjMenuItem.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                editSObjMenuItemActionPerformed(evt);
            }
        });
        jPopupMenu1.add(editSObjMenuItem);
        jPopupMenu1.add(jSeparator1);

        setSObjFromBufferMenuItem.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.setSObjFromBufferMenuItem.text")); // NOI18N
        setSObjFromBufferMenuItem.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                setSObjFromBufferMenuItemActionPerformed(evt);
            }
        });
        jPopupMenu1.add(setSObjFromBufferMenuItem);

        copySObjToBufferMenuItem.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.copySObjToBufferMenuItem.text")); // NOI18N
        copySObjToBufferMenuItem.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                copySObjToBufferMenuItemActionPerformed(evt);
            }
        });
        jPopupMenu1.add(copySObjToBufferMenuItem);
        jPopupMenu1.add(jSeparator2);

        changeSObjMenu.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.changeSObjMenu.text")); // NOI18N
        jPopupMenu1.add(changeSObjMenu);

        setLayout(new javax.swing.BoxLayout(this, javax.swing.BoxLayout.LINE_AXIS));

        jPanel1.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 3, 0, 3));
        jPanel1.setMinimumSize(new java.awt.Dimension(0, 0));
        jPanel1.setPreferredSize(new java.awt.Dimension(17, 17));
        jPanel1.setLayout(new java.awt.CardLayout());

        nameLabel.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.nameLabel.text")); // NOI18N
        nameLabel.setMinimumSize(new java.awt.Dimension(0, 15));
        jPanel1.add(nameLabel, "label");

        nameText.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.nameText.text")); // NOI18N
        nameText.setMinimumSize(new java.awt.Dimension(0, 15));
        nameText.setPreferredSize(new java.awt.Dimension(115, 17));
        nameText.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                nameTextActionPerformed(evt);
            }
        });
        nameText.addFocusListener(new java.awt.event.FocusAdapter() {
            public void focusLost(java.awt.event.FocusEvent evt) {
                nameTextFocusLost(evt);
            }
        });
        nameText.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                nameTextKeyPressed(evt);
            }
        });
        jPanel1.add(nameText, "textField");

        add(jPanel1);

        muteToggleButton.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.muteToggleButton.text")); // NOI18N
        muteToggleButton.setFocusPainted(false);
        muteToggleButton.setFocusable(false);
        muteToggleButton.setMargin(new java.awt.Insets(0, 3, 0, 3));
        muteToggleButton.setMaximumSize(new java.awt.Dimension(19, 19));
        muteToggleButton.setPreferredSize(new java.awt.Dimension(19, 19));
        muteToggleButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                muteToggleButtonActionPerformed(evt);
            }
        });
        add(muteToggleButton);

        soloToggleButton.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.soloToggleButton.text")); // NOI18N
        soloToggleButton.setFocusPainted(false);
        soloToggleButton.setFocusable(false);
        soloToggleButton.setMargin(new java.awt.Insets(0, 3, 0, 3));
        soloToggleButton.setMaximumSize(new java.awt.Dimension(19, 19));
        soloToggleButton.setPreferredSize(new java.awt.Dimension(19, 19));
        soloToggleButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                soloToggleButtonActionPerformed(evt);
            }
        });
        add(soloToggleButton);

        otherMenuButton.setFont(new java.awt.Font("Dialog", 1, 10)); // NOI18N
        otherMenuButton.setIcon(IconFactory.getDownArrowIcon());
        otherMenuButton.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.otherMenuButton.text")); // NOI18N
        otherMenuButton.setToolTipText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.otherMenuButton.toolTipText")); // NOI18N
        otherMenuButton.setFocusPainted(false);
        otherMenuButton.setFocusable(false);
        otherMenuButton.setMargin(new java.awt.Insets(5, 0, 4, 0));
        otherMenuButton.setPreferredSize(new java.awt.Dimension(16, 17));
        otherMenuButton.setSize(new java.awt.Dimension(19, 19));
        otherMenuButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                otherMenuButtonActionPerformed(evt);
            }
        });
        add(otherMenuButton);
    }// </editor-fold>//GEN-END:initComponents

    private void nameTextActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_nameTextActionPerformed
        if (patternLayer == null) {
            return;
        }

        patternLayer.setName(nameText.getText());
        nameLabel.setText(patternLayer.getName());

        ((CardLayout) jPanel1.getLayout()).show(jPanel1, "label");
    }//GEN-LAST:event_nameTextActionPerformed

    private void nameTextFocusLost(java.awt.event.FocusEvent evt) {//GEN-FIRST:event_nameTextFocusLost
        if (patternLayer == null) {
            return;
        }

        final var newName = nameText.getText();
        if (!newName.equals(patternLayer.getName())) {
            patternLayer.setName(nameText.getText());
            nameLabel.setText(patternLayer.getName());
        }
        
        ((CardLayout) jPanel1.getLayout()).show(jPanel1, "label");
    }//GEN-LAST:event_nameTextFocusLost

    private void nameTextKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_nameTextKeyPressed
        if (evt.getKeyCode() == KeyEvent.VK_ESCAPE) {
            nameText.setText(patternLayer.getName());
            ((CardLayout) jPanel1.getLayout()).show(jPanel1, "label");
        }
    }//GEN-LAST:event_nameTextKeyPressed

    private void muteToggleButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_muteToggleButtonActionPerformed
        patternLayer.setMuted(muteToggleButton.isSelected());
    }//GEN-LAST:event_muteToggleButtonActionPerformed

    private void soloToggleButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_soloToggleButtonActionPerformed
        patternLayer.setSolo(soloToggleButton.isSelected());
    }//GEN-LAST:event_soloToggleButtonActionPerformed

    @SuppressWarnings("unchecked")
    private void otherMenuButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_otherMenuButtonActionPerformed

        Class<? extends SoundObject> current = patternLayer.getSoundObject().getClass();

        for (Component c : changeSObjMenu.getMenuComponents()) {
            JMenuItem menuItem = (JMenuItem) c;
            Class<? extends SoundObject> clazz = (Class<? extends SoundObject>) menuItem.getClientProperty("sObjClass");
            menuItem.setEnabled(!current.equals(clazz));
        }

        ScoreController controller = ScoreController.getInstance();
        Collection<? extends ScoreObject> selected = controller.getSelectedScoreObjects();
        setSObjFromBufferMenuItem.setEnabled(selected.size() == 1 && 
                selected.iterator().next() instanceof SoundObject);

        jPopupMenu1.show(otherMenuButton, 0, otherMenuButton.getHeight());
    }//GEN-LAST:event_otherMenuButtonActionPerformed

    private void editSObjMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_editSObjMenuItemActionPerformed
        editSoundObject();
    }//GEN-LAST:event_editSObjMenuItemActionPerformed

    private void setSObjFromBufferMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_setSObjFromBufferMenuItemActionPerformed
        var buffer = BlueClipboardUtils.getScoreObjectCopy();
        if (buffer != null && buffer.scoreObjects.size() == 1) {
            ScoreObject scoreObj = buffer.scoreObjects.get(0);
            if(!(scoreObj instanceof SoundObject)) {
               return; 
            }
            SoundObject sObj = (SoundObject) scoreObj;
            SoundObject copy = sObj.deepCopy();
            copy.setStartTime(0.0f);
            copy.setSubjectiveDuration(4);
            copy.setTimeBehavior(TimeBehavior.NONE);
            patternLayer.setSoundObject(copy);
            editSoundObject();
        }
    }//GEN-LAST:event_setSObjFromBufferMenuItemActionPerformed

    private void copySObjToBufferMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_copySObjToBufferMenuItemActionPerformed
        ScoreObject copy = patternLayer.getSoundObject().deepCopy();
        ScoreController.getInstance().setSelectedScoreObjects(Collections.singleton(copy));
    }//GEN-LAST:event_copySObjToBufferMenuItemActionPerformed

    public void editName() {
        if (patternLayer == null) {
            return;
        }

        nameText.setText(patternLayer.getName());
        ((CardLayout) jPanel1.getLayout()).show(jPanel1, "textField");
        nameText.requestFocusInWindow();
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JMenu changeSObjMenu;
    private javax.swing.JMenuItem copySObjToBufferMenuItem;
    private javax.swing.JMenuItem editSObjMenuItem;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JPopupMenu jPopupMenu1;
    private javax.swing.JPopupMenu.Separator jSeparator1;
    private javax.swing.JPopupMenu.Separator jSeparator2;
    private javax.swing.JToggleButton muteToggleButton;
    private javax.swing.JLabel nameLabel;
    private javax.swing.JTextField nameText;
    private javax.swing.JButton otherMenuButton;
    private javax.swing.JMenuItem setSObjFromBufferMenuItem;
    private javax.swing.JToggleButton soloToggleButton;
    // End of variables declaration//GEN-END:variables

    @Override
    public void removeNotify() {
        super.removeNotify();
        if (this.patternLayer != null) {
            this.patternLayer.removePropertyChangeListener(this);
        }
    }

    @Override
    public void addNotify() {
        super.addNotify();
        if (this.patternLayer != null) {
            this.patternLayer.addPropertyChangeListener(this);
        }
    }

    public void setSelected(boolean val) {
        setBorder(val ? selectionBorder : border);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.patternLayer) {
            String propName = evt.getPropertyName();

            if (propName.equals("name")) {
                nameText.setText(patternLayer.getName());
                nameLabel.setText(patternLayer.getName());
            }
        }
    }
}
