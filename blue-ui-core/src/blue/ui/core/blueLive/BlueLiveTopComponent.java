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
package blue.ui.core.blueLive;

import blue.Arrangement;
import blue.BlueData;
import blue.BluePluginManager;
import blue.BlueSystem;
import blue.GlobalOrcSco;
import blue.LiveData;
import blue.Tables;
import blue.blueLive.LiveObject;
import blue.event.SelectionEvent;
import blue.event.SimpleDocumentListener;
import blue.gui.ExceptionDialog;
import blue.midi.*;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.ui.core.score.SoundObjectBuffer;
import blue.ui.core.score.SoundObjectSelectionBus;
import blue.ui.utilities.UiUtilities;
import blue.utility.ObjectUtilities;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.logging.Logger;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.Receiver;
import javax.swing.JButton;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.text.BadLocationException;
import javax.swing.text.Document;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
//import org.openide.util.ImageUtilities;
import org.netbeans.api.settings.ConvertAsProperties;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(dtd = "-//blue.ui.core.blueLive//BlueLive//EN",
autostore = false)
public final class BlueLiveTopComponent extends TopComponent {

    private static BlueLiveTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "BlueLiveTopComponent";

    BlueData data = null;

    SoundObjectBuffer buffer = SoundObjectBuffer.getInstance();

    LiveObjectsTableModel model;

    AddMenu addPopup = null;

    BufferMenu bufferPopup = new BufferMenu();

    MidiInputManager midiManager;

    ScoPadReceiver scoPadReceiver = new ScoPadReceiver();

    JPopupMenu noteTemplatePopup;

    ArrayList<Class> plugins = BluePluginManager.getInstance().getLiveSoundObjectClasses();

    BlueLiveToolBar blueLiveToolBar;

    public BlueLiveTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(BlueLiveTopComponent.class,
                "CTL_BlueLiveTopComponent"));
        setToolTipText(NbBundle.getMessage(BlueLiveTopComponent.class,
                "HINT_BlueLiveTopComponent"));
//        setIcon(ImageUtilities.loadImage(ICON_PATH, true));

        blueLiveToolBar = BlueLiveToolBar.getInstance();

        setupNoteTemplatePopup();

        model = new LiveObjectsTableModel();

        liveObjectsTable.setDefaultRenderer(JButton.class,
                new ButtonCellRenderer());
        liveObjectsTable.setDefaultEditor(JButton.class, new ButtonCellEditor(
                this));
        liveObjectsTable.setDefaultRenderer(MidiKeyRenderer.class,
                new MidiKeyRenderer());
        liveObjectsTable.setDefaultRenderer(KeyboardKeyRenderer.class,
                new KeyboardKeyRenderer());

        liveObjectsTable.setModel(model);
        liveObjectsTable.setRowHeight(24);
        liveObjectsTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        liveObjectsTable.getSelectionModel().addListSelectionListener(
                new ListSelectionListener() {

                    public void valueChanged(ListSelectionEvent e) {
                        if (!e.getValueIsAdjusting()) {
                            if (data == null) {
                                return;
                            }
                            int index = liveObjectsTable.getSelectedRow();

                            ArrayList liveObjects = data.getLiveData().
                                    getLiveSoundObjects();

                            if (index >= 0 && index < liveObjects.size()) {
                                final LiveObject liveObj = (LiveObject) liveObjects.
                                        get(index);

                                SwingUtilities.invokeLater(new Runnable() {

                                    public void run() {
                                        SelectionEvent se = new SelectionEvent(
                                                liveObj.getSoundObject(),
                                                SelectionEvent.SELECTION_SINGLE,
                                                SelectionEvent.SELECTION_BLUE_LIVE);
                                        SoundObjectSelectionBus.getInstance().
                                                selectionPerformed(se);
                                    }
                                });

                            }
                        }
                    }
                });

        liveObjectsTable.addMouseListener(new MouseAdapter() {

            public void mousePressed(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)) {
                    bufferPopup.show(liveObjectsTable, e.getX(), e.getY());
                }
            }
        });

        commandLineText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    public void documentChanged(DocumentEvent e) {
                        if (data == null) {
                            return;
                        }

                        data.getLiveData().setCommandLine(
                                commandLineText.getText());
                    }
                });


        midiManager = MidiInputManager.getInstance();

        // receiver for live space tab
        midiManager.addReceiver(new Receiver() {

            public void send(MidiMessage message, long timeStamp) {
                if (jTabbedPane1.getSelectedIndex() != 0) {
                    return;
                }
            }

            public void close() {
            }
        });

        // receiver for SCO pad tab
        midiManager.addReceiver(scoPadReceiver);

        startSpinner.setModel(new SpinnerNumberModel(0.0, 0.0,
                Double.POSITIVE_INFINITY, 1.0));
        quarterNoteSpinner.setModel(new SpinnerNumberModel(1.0, 0.0,
                Double.POSITIVE_INFINITY, 1.0));

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();
    }

    private void reinitialize() {
        this.data = null;

        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData currentData = null;

        if (project != null) {
            currentData = project.getData();
        }

        if (currentData != null) {

            LiveData liveData = currentData.getLiveData();

            this.model.setLiveObjects(liveData.getLiveSoundObjects());
            this.commandLineText.setText(liveData.getCommandLine());

            this.enableAdvancedFlags.setSelected(liveData.isCommandLineEnabled());
            this.completeOverride.setSelected(liveData.isCommandLineOverride());

            commandLineText.setEnabled(liveData.isCommandLineEnabled());

            liveObjectsTable.getColumnModel().getColumn(2).setMaxWidth(100);
            liveObjectsTable.getColumnModel().getColumn(2).setMinWidth(100);
            liveObjectsTable.getColumnModel().getColumn(2).setWidth(100);

            // csoundCommand.setText(data.getLiveData().getCommandLine());
            // liveSpace.setLiveObjects(data.getLiveData().getLiveSoundObjects());

            // sObjEditPanel.editSoundObject(null);

            this.data = currentData;

            this.repaint();
        }

    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jTabbedPane1 = new javax.swing.JTabbedPane();
        liveSpacePanel = new javax.swing.JPanel();
        jScrollPane1 = new javax.swing.JScrollPane();
        liveObjectsTable = new JTable() {      public boolean getScrollableTracksViewportHeight() {         return getPreferredSize().height < getParent().getHeight();     }      };
        addButton = new javax.swing.JButton();
        removeButton = new javax.swing.JButton();
        pushUpBUtton = new javax.swing.JButton();
        pushDownButton = new javax.swing.JButton();
        scoPadPanel = new javax.swing.JPanel();
        jLabel4 = new javax.swing.JLabel();
        startSpinner = new javax.swing.JSpinner();
        jLabel3 = new javax.swing.JLabel();
        jScrollPane2 = new javax.swing.JScrollPane();
        outputTextArea = new javax.swing.JTextArea();
        jLabel1 = new javax.swing.JLabel();
        noteTemplateText = new javax.swing.JTextField();
        jLabel2 = new javax.swing.JLabel();
        quarterNoteSpinner = new javax.swing.JSpinner();
        jLabel5 = new javax.swing.JLabel();
        instrIdText = new javax.swing.JTextField();
        jPanel1 = new javax.swing.JPanel();
        completeOverride = new javax.swing.JCheckBox();
        commandLineText = new javax.swing.JTextField();
        enableAdvancedFlags = new javax.swing.JCheckBox();

        liveObjectsTable.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null}
            },
            new String [] {
                "Title 1", "Title 2", "Title 3", "Title 4"
            }
        ));
        jScrollPane1.setViewportView(liveObjectsTable);

        org.openide.awt.Mnemonics.setLocalizedText(addButton, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.addButton.text")); // NOI18N
        addButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                addButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(removeButton, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.removeButton.text")); // NOI18N
        removeButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                removeButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(pushUpBUtton, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.pushUpBUtton.text")); // NOI18N
        pushUpBUtton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushUpBUttonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(pushDownButton, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.pushDownButton.text")); // NOI18N
        pushDownButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushDownButtonActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout liveSpacePanelLayout = new org.jdesktop.layout.GroupLayout(liveSpacePanel);
        liveSpacePanel.setLayout(liveSpacePanelLayout);
        liveSpacePanelLayout.setHorizontalGroup(
            liveSpacePanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(liveSpacePanelLayout.createSequentialGroup()
                .addContainerGap()
                .add(liveSpacePanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jScrollPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 501, Short.MAX_VALUE)
                    .add(liveSpacePanelLayout.createSequentialGroup()
                        .add(addButton)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(removeButton)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(pushUpBUtton)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(pushDownButton)))
                .addContainerGap())
        );
        liveSpacePanelLayout.setVerticalGroup(
            liveSpacePanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(liveSpacePanelLayout.createSequentialGroup()
                .addContainerGap()
                .add(liveSpacePanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(addButton)
                    .add(removeButton)
                    .add(pushUpBUtton)
                    .add(pushDownButton))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jScrollPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 326, Short.MAX_VALUE)
                .addContainerGap())
        );

        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.liveSpacePanel.TabConstraints.tabTitle"), liveSpacePanel); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel4, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel4.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel3, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel3.text")); // NOI18N

        outputTextArea.setColumns(20);
        outputTextArea.setEditable(false);
        outputTextArea.setRows(5);
        outputTextArea.addKeyListener(new java.awt.event.KeyAdapter() {
            public void keyPressed(java.awt.event.KeyEvent evt) {
                outputTextAreaKeyPressed(evt);
            }
        });
        jScrollPane2.setViewportView(outputTextArea);

        org.openide.awt.Mnemonics.setLocalizedText(jLabel1, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel1.text")); // NOI18N

        noteTemplateText.setText(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.noteTemplateText.text")); // NOI18N
        noteTemplateText.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                noteTemplateTextMousePressed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel2, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel2.text")); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(jLabel5, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel5.text")); // NOI18N

        instrIdText.setText(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.instrIdText.text")); // NOI18N

        org.jdesktop.layout.GroupLayout scoPadPanelLayout = new org.jdesktop.layout.GroupLayout(scoPadPanel);
        scoPadPanel.setLayout(scoPadPanelLayout);
        scoPadPanelLayout.setHorizontalGroup(
            scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(scoPadPanelLayout.createSequentialGroup()
                .addContainerGap()
                .add(scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(jScrollPane2, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 501, Short.MAX_VALUE)
                    .add(jLabel3)
                    .add(scoPadPanelLayout.createSequentialGroup()
                        .add(scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(jLabel1)
                            .add(jLabel5))
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(scoPadPanelLayout.createSequentialGroup()
                                .add(instrIdText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 93, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel4)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(startSpinner, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 74, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(jLabel2)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(quarterNoteSpinner, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, 84, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                            .add(noteTemplateText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 427, Short.MAX_VALUE))))
                .addContainerGap())
        );
        scoPadPanelLayout.setVerticalGroup(
            scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(scoPadPanelLayout.createSequentialGroup()
                .addContainerGap()
                .add(scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel1)
                    .add(noteTemplateText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(scoPadPanelLayout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel5)
                    .add(jLabel4)
                    .add(startSpinner, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(jLabel2)
                    .add(quarterNoteSpinner, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(instrIdText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jLabel3)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jScrollPane2, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 283, Short.MAX_VALUE)
                .addContainerGap())
        );

        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.scoPadPanel.TabConstraints.tabTitle"), scoPadPanel); // NOI18N

        org.openide.awt.Mnemonics.setLocalizedText(completeOverride, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.completeOverride.text")); // NOI18N
        completeOverride.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        completeOverride.setMargin(new java.awt.Insets(0, 0, 0, 0));
        completeOverride.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                completeOverrideActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(enableAdvancedFlags, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.enableAdvancedFlags.text")); // NOI18N
        enableAdvancedFlags.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        enableAdvancedFlags.setMargin(new java.awt.Insets(0, 0, 0, 0));
        enableAdvancedFlags.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                enableAdvancedFlagsActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout jPanel1Layout = new org.jdesktop.layout.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .add(enableAdvancedFlags)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(completeOverride)
                    .add(commandLineText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 402, Short.MAX_VALUE))
                .addContainerGap())
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .add(jPanel1Layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(enableAdvancedFlags)
                    .add(commandLineText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(completeOverride)
                .addContainerGap(325, Short.MAX_VALUE))
        );

        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jPanel1.TabConstraints.tabTitle"), jPanel1); // NOI18N

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(jTabbedPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 526, Short.MAX_VALUE)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(org.jdesktop.layout.GroupLayout.TRAILING, layout.createSequentialGroup()
                .addContainerGap()
                .add(jTabbedPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 402, Short.MAX_VALUE)
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    private void completeOverrideActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_completeOverrideActionPerformed
        if (data == null) {
            return;
        }

        data.getLiveData().setCommandLineOverride(completeOverride.isSelected());
    }//GEN-LAST:event_completeOverrideActionPerformed

    private void enableAdvancedFlagsActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_enableAdvancedFlagsActionPerformed
        if (data == null) {
            return;
        }

        data.getLiveData().setCommandLineEnabled(
                enableAdvancedFlags.isSelected());
        commandLineText.setEnabled(enableAdvancedFlags.isSelected());
    }//GEN-LAST:event_enableAdvancedFlagsActionPerformed

    private void addButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_addButtonActionPerformed
        if (addPopup == null) {
            addPopup = new AddMenu();
        }

        int x = addButton.getWidth();
        int y = 0;

        addPopup.show(addButton, x, y);
    }//GEN-LAST:event_addButtonActionPerformed

    private void removeButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_removeButtonActionPerformed
        int index = liveObjectsTable.getSelectedRow();

        if (index >= 0) {
            model.removeLiveObject(index);
            SoundObjectSelectionBus.getInstance().selectionPerformed(
                    new SelectionEvent(null, SelectionEvent.SELECTION_CLEAR));
        }
    }//GEN-LAST:event_removeButtonActionPerformed

    private void pushUpBUttonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_pushUpBUttonActionPerformed
        int row = liveObjectsTable.getSelectedRow();

        if (row < 1 || row > model.getRowCount()) {
            return;
        }

        model.pushUp(row);

        liveObjectsTable.setRowSelectionInterval(row - 1, row - 1);
    }//GEN-LAST:event_pushUpBUttonActionPerformed

    private void pushDownButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_pushDownButtonActionPerformed
        int row = liveObjectsTable.getSelectedRow();

        if (row < 0 || row > model.getRowCount() - 1) {
            return;
        }

        model.pushDown(row);

        liveObjectsTable.setRowSelectionInterval(row + 1, row + 1);
    }//GEN-LAST:event_pushDownButtonActionPerformed

    private void outputTextAreaKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_outputTextAreaKeyPressed
//        if (!midiManager.isMidiDeviceOpen()) {
//            return;
//        }

        int key = evt.getKeyCode();
        double time = 0;
        String txt;

        if ((evt.getModifiers() & BlueSystem.getMenuShortcutKey()) == BlueSystem.
                getMenuShortcutKey()) {
            switch (key) {
                case KeyEvent.VK_PERIOD:

                    break;
            }

            return;
        }

        switch (key) {
            case KeyEvent.VK_PERIOD:

                return;
            case KeyEvent.VK_0:
                return;

            case KeyEvent.VK_1:
                time = 0.125;
                break;
            case KeyEvent.VK_2:
                time = 0.25;
                break;
            case KeyEvent.VK_3:
                time = 0.5;
                break;
            case KeyEvent.VK_4:
                time = 1.0;
                break;
            case KeyEvent.VK_5:
                time = 2.0;
                break;
            case KeyEvent.VK_6:
                time = 4.0;
                break;
            case KeyEvent.VK_7:
                time = 8.0;
                break;
            case KeyEvent.VK_8:
                return;
            case KeyEvent.VK_9:
                return;
            default:
                return;
        }

        float start = ((Double) startSpinner.getValue()).floatValue();
        String template = noteTemplateText.getText();
        String instrId = instrIdText.getText();
        float quarterNote = ((Double) quarterNoteSpinner.getValue()).floatValue();
        float dur = quarterNote * (float) time;

        outputTextArea.setText(outputTextArea.getText() + scoPadReceiver.
                getNotes(template, instrId, start, dur));

        startSpinner.setValue(new Double(start + dur));
    }//GEN-LAST:event_outputTextAreaKeyPressed

    private void noteTemplateTextMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_noteTemplateTextMousePressed
        if (UiUtilities.isRightMouseButton(evt)) {
            noteTemplatePopup.show(noteTemplateText, evt.getX(), evt.getY());
        }
    }//GEN-LAST:event_noteTemplateTextMousePressed

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton addButton;
    private javax.swing.JTextField commandLineText;
    private javax.swing.JCheckBox completeOverride;
    private javax.swing.JCheckBox enableAdvancedFlags;
    private javax.swing.JTextField instrIdText;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JTabbedPane jTabbedPane1;
    private javax.swing.JTable liveObjectsTable;
    private javax.swing.JPanel liveSpacePanel;
    private javax.swing.JTextField noteTemplateText;
    private javax.swing.JTextArea outputTextArea;
    private javax.swing.JButton pushDownButton;
    private javax.swing.JButton pushUpBUtton;
    private javax.swing.JSpinner quarterNoteSpinner;
    private javax.swing.JButton removeButton;
    private javax.swing.JPanel scoPadPanel;
    private javax.swing.JSpinner startSpinner;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized BlueLiveTopComponent getDefault() {
        if (instance == null) {
            instance = new BlueLiveTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the BlueLiveTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized BlueLiveTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(
                PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(BlueLiveTopComponent.class.getName()).warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof BlueLiveTopComponent) {
            return (BlueLiveTopComponent) win;
        }
        Logger.getLogger(BlueLiveTopComponent.class.getName()).warning(
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

    void writeProperties(java.util.Properties p) {
        // better to version settings since initial version as advocated at
        // http://wiki.apidesign.org/wiki/PropertyFiles
        p.setProperty("version", "1.0");
        // TODO store your settings
    }

    Object readProperties(java.util.Properties p) {
        BlueLiveTopComponent singleton = BlueLiveTopComponent.getDefault();
        singleton.readPropertiesImpl(p);
        return singleton;
    }

    private void readPropertiesImpl(java.util.Properties p) {
        String version = p.getProperty("version");
        // TODO read your settings according to their version
    }

    @Override
    protected String preferredID() {
        return PREFERRED_ID;
    }

    private void setupNoteTemplatePopup() {
        noteTemplatePopup = new JPopupMenu();

        String[] items = {"<START>", "<DUR>", "<KEY>", "<KEY_CPS>",
            "<KEY_OCT>", "<KEY_PCH>", "<VELOCITY>", "<VELOCITY_AMP>"};

        final ActionListener al = new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                if (noteTemplateText.isEnabled()) {
                    int loc = noteTemplateText.getCaret().getDot();
                    int mark = noteTemplateText.getCaret().getMark();

                    int start = loc < mark ? loc : mark;
                    int len = Math.abs(loc - mark);

                    Document doc = noteTemplateText.getDocument();

                    try {
                        if (len > 0) {
                            doc.remove(start, len);
                        }

                        doc.insertString(start, e.getActionCommand(), null);
                    } catch (BadLocationException ex) {
                        ex.printStackTrace();
                    }
                }
            }
        };

        for (int i = 0; i < items.length; i++) {
            JMenuItem item = new JMenuItem(items[i]);
            item.addActionListener(al);
            noteTemplatePopup.add(item);
        }
    }

    protected void triggerLiveObject(int index) {
        if (data == null || index < 0) {
            return;
        }

        ArrayList liveObjects = data.getLiveData().getLiveSoundObjects();

        if (index < liveObjects.size()) {
            LiveObject liveObj = (LiveObject) liveObjects.get(index);
            SoundObject sObj = liveObj.getSoundObject();

            if (sObj.getTimeBehavior() != SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED) {
                sObj.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
            }
            String scoreText = null;

            try {

                sObj.generateGlobals(new GlobalOrcSco());
                sObj.generateFTables(new Tables());
                sObj.generateInstruments(new Arrangement());
                scoreText = sObj.generateNotes(0.0f, -1.0f).toString();
            } catch (SoundObjectException e) {
                ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
                        e);
            }

            if (scoreText != null && scoreText.length() > 0) {
                blueLiveToolBar.sendEvents(scoreText);
            }

        }
    }

    protected void addSoundObject(SoundObject sObj) {
        int index = liveObjectsTable.getSelectedRow();

        if (index < 0 || index >= model.getRowCount() - 1) {
            model.addLiveObject(new LiveObject(sObj));
        } else {
            model.addLiveObject(index + 1, new LiveObject(sObj));
        }
    }

    class AddMenu extends JPopupMenu implements ActionListener {

        HashMap<String, Class> sObjNameClassMap = new HashMap<String, Class>();

        public AddMenu() {

            for (Class sObjClass : plugins) {
              
                String className = sObjClass.getName();

                sObjNameClassMap.put(className, sObjClass);

                JMenuItem temp = new JMenuItem();
                temp.setText(BlueSystem.getString("soundLayerPopup.addNew") + " " + BlueSystem.
                        getShortClassName(className));
                temp.setActionCommand(className);
                temp.addActionListener(this);
                this.add(temp);
            }

        }

        public void actionPerformed(ActionEvent ae) {

            try {

                String sObjName = ae.getActionCommand();
                Class c = BlueSystem.getClassLoader().loadClass(sObjName);

                SoundObject sObj = (SoundObject) c.newInstance();
                addSoundObject(sObj);
            } catch (ClassNotFoundException cnfe) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                        "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.
                        getActionCommand());
            } catch (IllegalAccessException iae) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                        "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.
                        getActionCommand());
            } catch (InstantiationException ie) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                        "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.
                        getActionCommand());
            }
        }
    }

    class BufferMenu extends JPopupMenu {

        JMenuItem removeInstrumentMenuItem = new JMenuItem(BlueSystem.getString(
                "common.remove"));

        JMenuItem cutMenuItem = new JMenuItem(BlueSystem.getString("common.cut"));

        JMenuItem copyMenuItem = new JMenuItem(BlueSystem.getString(
                "common.copy"));

        JMenuItem pasteMenuItem = new JMenuItem(BlueSystem.getString(
                "common.paste"));

        JMenuItem convertToBSB = new JMenuItem();

        public BufferMenu() {
            removeInstrumentMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    if (buffer == null) {
                        return;
                    }

                    int index = liveObjectsTable.getSelectedRow();

                    ArrayList liveObjects = data.getLiveData().
                            getLiveSoundObjects();

                    if (index >= 0 && index < liveObjects.size()) {
                        model.removeLiveObject(index);
                        SoundObjectSelectionBus.getInstance().selectionPerformed(
                            new SelectionEvent(null, SelectionEvent.SELECTION_CLEAR));
                    }
                }
            });
            cutMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    if (buffer == null) {
                        return;
                    }

                    int index = liveObjectsTable.getSelectedRow();

                    ArrayList liveObjects = data.getLiveData().
                            getLiveSoundObjects();

                    if (index >= 0 && index < liveObjects.size()) {

                        LiveObject liveObj = (LiveObject) liveObjects.get(index);

                        SoundObject copy = (SoundObject) ObjectUtilities.clone(liveObj.
                                getSoundObject());

                        buffer.setBufferedObject(copy, 0, 0);

                        model.removeLiveObject(index);
                        SoundObjectSelectionBus.getInstance().selectionPerformed(
                            new SelectionEvent(null, SelectionEvent.SELECTION_CLEAR));
                    }
                }
            });
            copyMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    if (buffer == null) {
                        return;
                    }

                    int index = liveObjectsTable.getSelectedRow();

                    ArrayList liveObjects = data.getLiveData().
                            getLiveSoundObjects();

                    if (index >= 0 && index < liveObjects.size()) {

                        LiveObject liveObj = (LiveObject) liveObjects.get(index);

                        SoundObject copy = (SoundObject) ObjectUtilities.clone(liveObj.
                                getSoundObject());

                        buffer.setBufferedObject(copy, 0, 0);
                    }
                }
            });
            pasteMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    SoundObject sObj = buffer.getBufferedSoundObject();

                    if (!plugins.contains(sObj.getClass())) {
                        return;
                    }

                    SoundObject copy = (SoundObject) ObjectUtilities.clone(sObj);
                    copy.setStartTime(0.0f);
                    addSoundObject(copy);
                }
            });

            this.add(removeInstrumentMenuItem);
            this.addSeparator();
            this.add(cutMenuItem);
            this.add(copyMenuItem);
            this.add(pasteMenuItem);

            setupPopupListener();
        }

        private void setupPopupListener() {
            this.addPopupMenuListener(new PopupMenuListener() {

                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    int rowIndex = liveObjectsTable.getSelectedRow();

                    boolean selected = (rowIndex >= 0);

                    cutMenuItem.setEnabled(selected);
                    copyMenuItem.setEnabled(selected);
                    removeInstrumentMenuItem.setEnabled(selected);

                    if (buffer == null || buffer.hasBufferedSoundObject()) {
                        pasteMenuItem.setEnabled(plugins.contains(buffer.
                                getBufferedSoundObject().getClass()));
                    } else {
                        pasteMenuItem.setEnabled(false);
                    }
                }

                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                public void popupMenuCanceled(PopupMenuEvent e) {
                }
            });

        }
    }
}
