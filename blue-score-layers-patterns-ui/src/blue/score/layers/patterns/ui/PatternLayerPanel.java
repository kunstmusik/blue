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

import blue.BlueSystem;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.plugin.BluePlugin;
import blue.score.layers.Layer;
import blue.score.layers.patterns.core.PatternLayer;
import blue.score.layers.patterns.core.PatternsPluginProvider;
import blue.soundObject.SoundObject;
import blue.ui.components.IconFactory;
import blue.ui.core.score.layers.soundObject.SoundObjectBuffer;
import blue.ui.core.score.layers.soundObject.SoundObjectEditorTopComponent;
import blue.ui.core.score.layers.soundObject.SoundObjectSelectionBus;
import blue.utility.ObjectUtilities;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.*;
import java.util.ArrayList;
import javax.swing.BorderFactory;
import javax.swing.JMenuItem;
import javax.swing.border.BevelBorder;
import javax.swing.border.Border;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class PatternLayerPanel extends javax.swing.JPanel 
        implements SelectionListener {
    private final PatternLayer patternLayer;

    private static final Border border = BorderFactory.createBevelBorder(BevelBorder.RAISED);
    private static final Border selectionBorder = BorderFactory.createBevelBorder(
            BevelBorder.RAISED, Color.GREEN, Color.GREEN.darker());
    /**
     * Creates new form PatternLayerPanel
     */
    public PatternLayerPanel(PatternLayer layer) {
        this.patternLayer = layer;
        initComponents();
        Dimension d = new Dimension(100, Layer.LAYER_HEIGHT);
        this.setSize(d);
        this.setPreferredSize(d);
        
        nameLabel.setText(patternLayer.getName());
        muteToggleButton.setSelected(patternLayer.isMuted());
        soloToggleButton.setSelected(patternLayer.isSolo());
        
        muteToggleButton.putClientProperty("BlueToggleButton.selectColorOverride", Color.ORANGE.darker());
        soloToggleButton.putClientProperty("BlueToggleButton.selectColorOverride", Color.GREEN.darker());
        addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {
                if(e.getClickCount() == 1) {
                    requestFocus();
                    editSoundObject();
                    e.consume();
                }
            }
            
            
        });
        
        ActionListener al = new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                JMenuItem temp = (JMenuItem)e.getSource();
                Class c = (Class) temp.getClientProperty("sObjClass");
                
                try {
                    SoundObject sObj = (SoundObject)c.newInstance();
                    patternLayer.setSoundObject(sObj);
                    editSoundObject();
                } catch (InstantiationException ex) {
                    Exceptions.printStackTrace(ex);
                } catch (IllegalAccessException ex) {
                    Exceptions.printStackTrace(ex);
                }
                
                
            }
            
        };
        
        ArrayList<BluePlugin> plugins = new PatternsPluginProvider().getPlugins(
                SoundObject.class);
        for (BluePlugin bluePlugin : plugins) {
            Class sObjClass = bluePlugin.getPluginClass();
            String className = sObjClass.getName();

            JMenuItem temp = new JMenuItem();
            temp.setText(BlueSystem.getShortClassName(className));
            temp.putClientProperty("sObjClass", sObjClass);
            temp.addActionListener(al);
            changeSObjMenu.add(temp);
        
        }
        
        setBorder(border);
        
        SoundObjectSelectionBus.getInstance().addSelectionListener(this);
    }

    protected void editSoundObject() {
        SelectionEvent se = new SelectionEvent(patternLayer.getSoundObject(), SelectionEvent.SELECTION_SINGLE);
        SoundObjectSelectionBus.getInstance().selectionPerformed(se);

        SoundObjectEditorTopComponent editor = SoundObjectEditorTopComponent.findInstance();

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
        nameLabel.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                nameLabelMousePressed(evt);
            }
        });
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

        muteToggleButton.setFont(new java.awt.Font("Dialog", 1, 10)); // NOI18N
        muteToggleButton.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.muteToggleButton.text")); // NOI18N
        muteToggleButton.setFocusPainted(false);
        muteToggleButton.setFocusable(false);
        muteToggleButton.setMargin(new java.awt.Insets(0, 3, 0, 3));
        muteToggleButton.setMaximumSize(new java.awt.Dimension(19, 19));
        muteToggleButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                muteToggleButtonActionPerformed(evt);
            }
        });
        add(muteToggleButton);

        soloToggleButton.setFont(new java.awt.Font("Dialog", 1, 10)); // NOI18N
        soloToggleButton.setText(org.openide.util.NbBundle.getMessage(PatternLayerPanel.class, "PatternLayerPanel.soloToggleButton.text")); // NOI18N
        soloToggleButton.setFocusPainted(false);
        soloToggleButton.setFocusable(false);
        soloToggleButton.setMargin(new java.awt.Insets(0, 3, 0, 3));
        soloToggleButton.setMaximumSize(new java.awt.Dimension(19, 19));
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
        ((CardLayout) jPanel1.getLayout()).show(jPanel1, "label");
    }//GEN-LAST:event_nameTextFocusLost

    private void nameTextKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_nameTextKeyPressed
        if (evt.getKeyCode() == KeyEvent.VK_ESCAPE) {
            ((CardLayout) jPanel1.getLayout()).show(jPanel1, "label");
        }
    }//GEN-LAST:event_nameTextKeyPressed

    private void muteToggleButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_muteToggleButtonActionPerformed
        patternLayer.setMuted(muteToggleButton.isSelected());
    }//GEN-LAST:event_muteToggleButtonActionPerformed

    private void soloToggleButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_soloToggleButtonActionPerformed
        patternLayer.setSolo(soloToggleButton.isSelected());
    }//GEN-LAST:event_soloToggleButtonActionPerformed

    private void otherMenuButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_otherMenuButtonActionPerformed
        
        Class current = patternLayer.getSoundObject().getClass();
        
        for(Component c : changeSObjMenu.getMenuComponents()) {
            JMenuItem menuItem = (JMenuItem)c;
            Class clazz = (Class) menuItem.getClientProperty("sObjClass");
            menuItem.setEnabled(!current.equals(clazz));
        }
        
        final SoundObjectBuffer sObjBuffer = SoundObjectBuffer.getInstance();
        setSObjFromBufferMenuItem.setEnabled(sObjBuffer.size() == 1);
        
        jPopupMenu1.show(otherMenuButton, 0, otherMenuButton.getHeight());
    }//GEN-LAST:event_otherMenuButtonActionPerformed

    private void nameLabelMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_nameLabelMousePressed
        if(evt.getClickCount() == 2) {
            editName();
            evt.consume();
        } else {
            this.processMouseEvent(evt);
        }
    }//GEN-LAST:event_nameLabelMousePressed

    private void editSObjMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_editSObjMenuItemActionPerformed
        editSoundObject();
    }//GEN-LAST:event_editSObjMenuItemActionPerformed

    private void setSObjFromBufferMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_setSObjFromBufferMenuItemActionPerformed
        final SoundObjectBuffer sObjBuffer = SoundObjectBuffer.getInstance();
        if(sObjBuffer.size() == 1) {
            SoundObject sObj = sObjBuffer.getBufferedSoundObject();
            SoundObject copy = (SoundObject) ObjectUtilities.clone(
                        sObj);
            copy.setStartTime(0.0f);
            copy.setSubjectiveDuration(4);
            copy.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
            patternLayer.setSoundObject(copy);
            editSoundObject();
        }
    }//GEN-LAST:event_setSObjFromBufferMenuItemActionPerformed

    private void copySObjToBufferMenuItemActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_copySObjToBufferMenuItemActionPerformed
        SoundObject copy = (SoundObject) ObjectUtilities.clone(
                            patternLayer.getSoundObject());
        SoundObjectBuffer.getInstance().setBufferedObject(copy, 0, 0);
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
        SoundObjectSelectionBus.getInstance().removeSelectionListener(this);
    }
    
    @Override
    public void selectionPerformed(SelectionEvent e) {
        if(e.getSelectedItem() == patternLayer.getSoundObject()) {
            this.setBorder(selectionBorder);
        } else {
            this.setBorder(border);
        }
    }
}
