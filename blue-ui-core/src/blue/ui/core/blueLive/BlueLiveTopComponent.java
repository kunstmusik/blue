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

import blue.*;
import blue.blueLive.LiveObject;
import blue.event.SelectionEvent;
import blue.event.SimpleDocumentListener;
import blue.gui.ExceptionDialog;
import blue.midi.*;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.ui.core.score.SoundObjectBuffer;
import blue.ui.core.score.SoundObjectSelectionBus;
import blue.ui.utilities.UiUtilities;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
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
import javax.swing.*;
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
import skt.swing.SwingUtil;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(dtd = "-//blue.ui.core.blueLive//BlueLive//EN",
autostore = false)
public final class BlueLiveTopComponent extends TopComponent {

    private static BlueLiveTopComponent instance;
    /**
     * path to the icon used by the component and its open action
     */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "BlueLiveTopComponent";
    BlueData data = null;
    SoundObjectBuffer buffer = SoundObjectBuffer.getInstance();
    LiveObjectsTableModel model;
    BufferMenu bufferPopup;
    MidiInputManager midiManager;
    ScoPadReceiver scoPadReceiver = new ScoPadReceiver();
    JPopupMenu noteTemplatePopup;
    ArrayList<Class> plugins = BluePluginManager.getInstance().getLiveSoundObjectClasses();
    BlueLiveToolBar blueLiveToolBar;
    int mouseColumn = -1;
    int mouseRow = -1;
    PerformanceThread performanceThread = null;

    public BlueLiveTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(BlueLiveTopComponent.class,
                "CTL_BlueLiveTopComponent"));
        setToolTipText(NbBundle.getMessage(BlueLiveTopComponent.class,
                "HINT_BlueLiveTopComponent"));
//        setIcon(ImageUtilities.loadImage(ICON_PATH, true));

        blueLiveToolBar = BlueLiveToolBar.getInstance();

        setupNoteTemplatePopup();

        model = new LiveObjectsTableModel(null);

//        liveObjectsTable.setDefaultRenderer(JButton.class,
//                new ButtonCellRenderer());
//        liveObjectsTable.setDefaultEditor(JButton.class, new ButtonCellEditor(
//                this));
//        liveObjectsTable.setDefaultRenderer(MidiKeyRenderer.class,
//                new MidiKeyRenderer());
//        liveObjectsTable.setDefaultRenderer(KeyboardKeyRenderer.class,
//                new KeyboardKeyRenderer());
        liveObjectsTable.setDefaultRenderer(LiveObject.class,
                new LiveObjectRenderer());

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
                            int row = liveObjectsTable.getSelectedRow();
                            int column = liveObjectsTable.getSelectedColumn();

                            final LiveObject lObj = (LiveObject) model.getValueAt(
                                    row, column);

                            if (lObj != null) {
                                SwingUtilities.invokeLater(new Runnable() {

                                    public void run() {
                                        SelectionEvent se = new SelectionEvent(
                                                lObj.getSoundObject(),
                                                SelectionEvent.SELECTION_SINGLE,
                                                SelectionEvent.SELECTION_BLUE_LIVE);
                                        SoundObjectSelectionBus.getInstance().
                                                selectionPerformed(se);
                                    }
                                });
                            } else {
                                SwingUtilities.invokeLater(new Runnable() {

                                    public void run() {
                                        SelectionEvent se = new SelectionEvent(
                                                null,
                                                SelectionEvent.SELECTION_CLEAR,
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
                    if (bufferPopup == null) {
                        bufferPopup = new BufferMenu();
                    }
                    mouseRow = liveObjectsTable.rowAtPoint(e.getPoint());
                    mouseColumn = liveObjectsTable.columnAtPoint(e.getPoint());
                    bufferPopup.show(liveObjectsTable, e.getX(), e.getY());
                } else if (e.getClickCount() == 2) {
                    mouseRow = liveObjectsTable.rowAtPoint(e.getPoint());
                    mouseColumn = liveObjectsTable.columnAtPoint(e.getPoint());
                    LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                            mouseRow, mouseColumn);

                    if (lObj != null) {
                        lObj.setEnabled(!lObj.isEnabled());
                        liveObjectsTable.repaint();
                    }
                }
            }
        });

        liveObjectsTable.setColumnSelectionAllowed(true);

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
                if (BlueProjectManager.CURRENT_PROJECT.equals(
                        evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();

        Action singleTrigger = new AbstractAction("trigger-single") {

            @Override
            public void actionPerformed(ActionEvent e) {
                LiveObject liveObject = (LiveObject) liveObjectsTable.getValueAt(
                        liveObjectsTable.getSelectedRow(),
                        liveObjectsTable.getSelectedColumn());

                if (liveObject != null) {
                    triggerLiveObject(liveObject);
                }

            }
        };
        singleTrigger.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_T, BlueSystem.getMenuShortcutKey()));
        
        Action multiTrigger = new AbstractAction("trigger-multi") {

            @Override
            public void actionPerformed(ActionEvent e) {
                triggerButtonActionPerformed(null);
            }
        };
        multiTrigger.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_T, BlueSystem.getMenuShortcutKey() | KeyEvent.SHIFT_DOWN_MASK));


        SwingUtil.installActions(liveObjectsTable, new Action[]{singleTrigger, multiTrigger});
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

            this.liveObjectsTable.setAutoCreateColumnsFromModel(true);
            model = new LiveObjectsTableModel(liveData.getLiveObjectBins());
            this.liveObjectsTable.setModel(model);

            this.commandLineText.setText(liveData.getCommandLine());

            this.enableAdvancedFlags.setSelected(liveData.isCommandLineEnabled());
            this.completeOverride.setSelected(liveData.isCommandLineOverride());

            commandLineText.setEnabled(liveData.isCommandLineEnabled());

//            liveObjectsTable.getColumnModel().getColumn(2).setMaxWidth(100);
//            liveObjectsTable.getColumnModel().getColumn(2).setMinWidth(100);
//            liveObjectsTable.getColumnModel().getColumn(2).setWidth(100);

            // csoundCommand.setText(data.getLiveData().getCommandLine());
            // liveSpace.setLiveObjects(data.getLiveData().getLiveSoundObjects());

            // sObjEditPanel.editSoundObject(null);

            repeatSpinner.setValue(liveData.getRepeat());
            tempoSpinner.setValue(liveData.getTempo());
            
            this.data = currentData;

            this.repaint();
        }

    }

    protected void triggerLiveObject(LiveObject liveObject) {
        NoteList nl = null;
        try {
            SoundObject sObj = liveObject.getSoundObject();

            if (sObj.getTimeBehavior() != SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED) {
                sObj.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
            }

            sObj.generateGlobals(new GlobalOrcSco());
            sObj.generateFTables(new Tables());
            sObj.generateInstruments(new Arrangement());
            nl = sObj.generateNotes(0.0f, -1.0f);
        } catch (SoundObjectException e) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
                    e);
        }

        if (nl == null) {
            return;
        }

        int tempo = (Integer) tempoSpinner.getValue();

        ScoreUtilities.scaleScore(nl, 60.0f / tempo);

        String scoreText = nl.toString();
        if (scoreText != null && scoreText.length() > 0) {
            blueLiveToolBar.sendEvents(scoreText);
        }
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jTabbedPane1 = new javax.swing.JTabbedPane();
        liveSpacePanel = new javax.swing.JPanel();
        jScrollPane1 = new javax.swing.JScrollPane();
        liveObjectsTable = new JTable() {      public boolean getScrollableTracksViewportHeight() {         return getPreferredSize().height < getParent().getHeight();     }      };
        triggerButton = new javax.swing.JButton();
        jLabel6 = new javax.swing.JLabel();
        tempoSpinner = new javax.swing.JSpinner();
        jLabel7 = new javax.swing.JLabel();
        repeatSpinner = new javax.swing.JSpinner();
        repeatButton = new javax.swing.JToggleButton();
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

        org.openide.awt.Mnemonics.setLocalizedText(triggerButton, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.triggerButton.text")); // NOI18N
        triggerButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                triggerButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel6, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel6.text")); // NOI18N

        tempoSpinner.setModel(new javax.swing.SpinnerNumberModel(60, 1, 300, 1));
        tempoSpinner.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                tempoSpinnerStateChanged(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(jLabel7, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jLabel7.text")); // NOI18N

        repeatSpinner.setModel(new javax.swing.SpinnerNumberModel(4, 1, 256, 1));
        repeatSpinner.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                repeatSpinnerStateChanged(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(repeatButton, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.repeatButton.text")); // NOI18N
        repeatButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                repeatButtonActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout liveSpacePanelLayout = new javax.swing.GroupLayout(liveSpacePanel);
        liveSpacePanel.setLayout(liveSpacePanelLayout);
        liveSpacePanelLayout.setHorizontalGroup(
            liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(liveSpacePanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 566, Short.MAX_VALUE)
                    .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, liveSpacePanelLayout.createSequentialGroup()
                        .addComponent(jLabel6)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(tempoSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 69, javax.swing.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(jLabel7)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(repeatSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 71, javax.swing.GroupLayout.PREFERRED_SIZE)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(repeatButton)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                        .addComponent(triggerButton)))
                .addContainerGap())
        );
        liveSpacePanelLayout.setVerticalGroup(
            liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(liveSpacePanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                    .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                        .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                            .addComponent(triggerButton)
                            .addComponent(repeatButton))
                        .addComponent(tempoSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                        .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING, false)
                            .addComponent(jLabel7, javax.swing.GroupLayout.Alignment.LEADING, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                            .addComponent(repeatSpinner, javax.swing.GroupLayout.Alignment.LEADING)))
                    .addComponent(jLabel6, javax.swing.GroupLayout.PREFERRED_SIZE, 29, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 309, Short.MAX_VALUE)
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

        javax.swing.GroupLayout scoPadPanelLayout = new javax.swing.GroupLayout(scoPadPanel);
        scoPadPanel.setLayout(scoPadPanelLayout);
        scoPadPanelLayout.setHorizontalGroup(
            scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(scoPadPanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(jScrollPane2, javax.swing.GroupLayout.DEFAULT_SIZE, 566, Short.MAX_VALUE)
                    .addComponent(jLabel3)
                    .addGroup(scoPadPanelLayout.createSequentialGroup()
                        .addGroup(scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(jLabel1)
                            .addComponent(jLabel5))
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addGroup(scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addGroup(scoPadPanelLayout.createSequentialGroup()
                                .addComponent(instrIdText, javax.swing.GroupLayout.PREFERRED_SIZE, 93, javax.swing.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addComponent(jLabel4)
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addComponent(startSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 74, javax.swing.GroupLayout.PREFERRED_SIZE)
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addComponent(jLabel2)
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addComponent(quarterNoteSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 84, javax.swing.GroupLayout.PREFERRED_SIZE))
                            .addComponent(noteTemplateText, javax.swing.GroupLayout.DEFAULT_SIZE, 468, Short.MAX_VALUE))))
                .addContainerGap())
        );
        scoPadPanelLayout.setVerticalGroup(
            scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(scoPadPanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel1)
                    .addComponent(noteTemplateText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(scoPadPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel5)
                    .addComponent(jLabel4)
                    .addComponent(startSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(jLabel2)
                    .addComponent(quarterNoteSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(instrIdText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jLabel3)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jScrollPane2, javax.swing.GroupLayout.DEFAULT_SIZE, 254, Short.MAX_VALUE)
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

        javax.swing.GroupLayout jPanel1Layout = new javax.swing.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(enableAdvancedFlags)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(completeOverride)
                    .addComponent(commandLineText, javax.swing.GroupLayout.DEFAULT_SIZE, 432, Short.MAX_VALUE))
                .addContainerGap())
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(jPanel1Layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(enableAdvancedFlags)
                    .addComponent(commandLineText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(completeOverride)
                .addContainerGap(294, Short.MAX_VALUE))
        );

        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.jPanel1.TabConstraints.tabTitle"), jPanel1); // NOI18N

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jTabbedPane1)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jTabbedPane1)
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

    private void outputTextAreaKeyPressed(java.awt.event.KeyEvent evt) {//GEN-FIRST:event_outputTextAreaKeyPressed
//        if (!midiManager.isMidiDeviceOpen()) {
//            return;
//        }

        int key = evt.getKeyCode();
        double time = 0;
        String txt;

        if ((evt.getModifiers() & BlueSystem.getMenuShortcutKey()) == BlueSystem.getMenuShortcutKey()) {
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

        outputTextArea.setText(outputTextArea.getText() + scoPadReceiver.getNotes(
                template, instrId, start, dur));

        startSpinner.setValue(new Double(start + dur));
    }//GEN-LAST:event_outputTextAreaKeyPressed

    private void noteTemplateTextMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_noteTemplateTextMousePressed
        if (UiUtilities.isRightMouseButton(evt)) {
            noteTemplatePopup.show(noteTemplateText, evt.getX(), evt.getY());
        }
    }//GEN-LAST:event_noteTemplateTextMousePressed

    private void triggerButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_triggerButtonActionPerformed

        if (data == null) {
            return;
        }

        ArrayList<LiveObject> liveObjects = data.getLiveData().getLiveObjectBins().getEnabledLiveObjects();

        if (liveObjects.size() > 0) {

            NoteList nl = new NoteList();
            try {

                for (LiveObject liveObj : liveObjects) {

                    SoundObject sObj = liveObj.getSoundObject();

                    if (sObj.getTimeBehavior() != SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED) {
                        sObj.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
                    }

                    sObj.generateGlobals(new GlobalOrcSco());
                    sObj.generateFTables(new Tables());
                    sObj.generateInstruments(new Arrangement());
                    nl.addAll(sObj.generateNotes(0.0f, -1.0f));
                }
            } catch (SoundObjectException e) {
                ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
                        e);
            }

            int tempo = (Integer) tempoSpinner.getValue();
            ScoreUtilities.scaleScore(nl, 60.0f / tempo);

            String scoreText = nl.toString();

            if (scoreText != null && scoreText.length() > 0) {
                blueLiveToolBar.sendEvents(scoreText);
            }

        }

    }//GEN-LAST:event_triggerButtonActionPerformed

    private void repeatButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_repeatButtonActionPerformed
        if (!blueLiveToolBar.isRunning()) {
            repeatButton.setSelected(false);
            return;
        }

        if (repeatButton.isSelected()) {
            if (performanceThread == null) {
                performanceThread = new PerformanceThread();
                performanceThread.start();
            }
        } else {
            if (performanceThread != null) {
                performanceThread.turnOff();
                performanceThread = null;
            }
        }


    }//GEN-LAST:event_repeatButtonActionPerformed

    private void tempoSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_tempoSpinnerStateChanged
        if (data == null) {
            return;
        }
        
        data.getLiveData().setTempo((Integer)tempoSpinner.getValue());
    }//GEN-LAST:event_tempoSpinnerStateChanged

    private void repeatSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_repeatSpinnerStateChanged
        if (data == null) {
            return;
        }
        
        data.getLiveData().setRepeat((Integer)repeatSpinner.getValue());
    }//GEN-LAST:event_repeatSpinnerStateChanged
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JTextField commandLineText;
    private javax.swing.JCheckBox completeOverride;
    private javax.swing.JCheckBox enableAdvancedFlags;
    private javax.swing.JTextField instrIdText;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel4;
    private javax.swing.JLabel jLabel5;
    private javax.swing.JLabel jLabel6;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JPanel jPanel1;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JTabbedPane jTabbedPane1;
    private javax.swing.JTable liveObjectsTable;
    private javax.swing.JPanel liveSpacePanel;
    private javax.swing.JTextField noteTemplateText;
    private javax.swing.JTextArea outputTextArea;
    private javax.swing.JSpinner quarterNoteSpinner;
    private javax.swing.JToggleButton repeatButton;
    private javax.swing.JSpinner repeatSpinner;
    private javax.swing.JPanel scoPadPanel;
    private javax.swing.JSpinner startSpinner;
    private javax.swing.JSpinner tempoSpinner;
    private javax.swing.JButton triggerButton;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files
     * only, i.e. deserialization routines; otherwise you could get a
     * non-deserialized instance. To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized BlueLiveTopComponent getDefault() {
        if (instance == null) {
            instance = new BlueLiveTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the BlueLiveTopComponent instance. Never call {@link #getDefault}
     * directly!
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
                "There seem to be multiple components with the '" + PREFERRED_ID
                + "' ID. That is a potential source of errors and unexpected behavior.");
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

    protected void addSoundObject(int column, int row, SoundObject sObj) {
        model.setValueAt(new LiveObject(sObj), row, column);
    }

    class PerformanceThread extends Thread {

        int beatCounter = 0;
        boolean keepRunning = true;
        int currentRepeatTempo;
        int currentRepeat;
        long waitTime;

        public void run() {
            while (keepRunning) {

                if (!blueLiveToolBar.isRunning()) {
                    keepRunning = false;
                    performanceThread = null;
                    repeatButton.setSelected(false);
                    break;
                }

                if (beatCounter == 0) {

                    currentRepeatTempo = ((Integer) tempoSpinner.getValue()).intValue();
                    currentRepeat = ((Integer) repeatSpinner.getValue()).intValue();
                    waitTime = (long) (1000 * (60.0f / currentRepeatTempo));

                    new Thread() {

                        public void run() {
                            triggerButtonActionPerformed(null);
                        }
                    }.start();
                }

                beatCounter++;

                if (beatCounter >= currentRepeat) {
                    beatCounter = 0;
                }


                try {
                    Thread.sleep(waitTime);
                } catch (InterruptedException ex) {
                    keepRunning = false;
                    repeatButton.setSelected(false);
                }
            }
        }

        public void turnOff() {
            keepRunning = false;
        }
    }

    class AddMenu extends JMenu implements ActionListener {

        HashMap<String, Class> sObjNameClassMap = new HashMap<String, Class>();

        public AddMenu() {

            super("Add SoundObject");

            for (Class sObjClass : plugins) {

                String className = sObjClass.getName();

                sObjNameClassMap.put(className, sObjClass);

                JMenuItem temp = new JMenuItem();
                temp.setText(BlueSystem.getString("soundLayerPopup.addNew") + " " + BlueSystem.getShortClassName(
                        className));
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
                addSoundObject(mouseColumn, mouseRow, sObj);
            } catch (ClassNotFoundException cnfe) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                        "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.getActionCommand());
            } catch (IllegalAccessException iae) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                        "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.getActionCommand());
            } catch (InstantiationException ie) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                        "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.getActionCommand());
            }
        }
    }

    class BufferMenu extends JPopupMenu {

        JMenu addMenu = new AddMenu();
        JMenuItem removeInstrumentMenuItem = new JMenuItem(BlueSystem.getString(
                "common.remove"));
        JMenuItem cutMenuItem = new JMenuItem(BlueSystem.getString(
                "common.cut"));
        JMenuItem copyMenuItem = new JMenuItem(BlueSystem.getString(
                "common.copy"));
        JMenuItem pasteMenuItem = new JMenuItem(BlueSystem.getString(
                "common.paste"));
        JMenuItem convertToBSB = new JMenuItem();
        JMenuItem insertRowBefore = new JMenuItem("Insert Row Before");
        JMenuItem insertRowAfter = new JMenuItem("Insert Row After");
        JMenuItem removeRow = new JMenuItem("Remove Row");
        JMenuItem insertColumnBefore = new JMenuItem("Insert Column Before");
        JMenuItem insertColumnAfter = new JMenuItem("Insert Column After");
        JMenuItem removeColumn = new JMenuItem("Remove Column");

        public BufferMenu() {
            removeInstrumentMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {

                    LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                            mouseRow, mouseColumn);

                    if (lObj != null) {
                        model.setValueAt(null, mouseRow, mouseColumn);
                        SoundObjectSelectionBus.getInstance().selectionPerformed(
                                new SelectionEvent(null,
                                SelectionEvent.SELECTION_CLEAR));
                    }
                }
            });
            cutMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                            mouseRow, mouseColumn);

                    if (lObj != null) {

                        SoundObject copy = (SoundObject) ObjectUtilities.clone(
                                lObj.getSoundObject());

                        buffer.setBufferedObject(copy, 0, 0);

                        model.setValueAt(null, mouseRow, mouseColumn);
                        SoundObjectSelectionBus.getInstance().selectionPerformed(
                                new SelectionEvent(null,
                                SelectionEvent.SELECTION_CLEAR));
                    }

                }
            });
            copyMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {

                    LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                            mouseRow, mouseColumn);

                    if (lObj != null) {

                        SoundObject copy = (SoundObject) ObjectUtilities.clone(
                                lObj.getSoundObject());

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

                    SoundObject copy = (SoundObject) ObjectUtilities.clone(
                            sObj);
                    copy.setStartTime(0.0f);
                    addSoundObject(mouseColumn, mouseRow, copy);
                }
            });

            /*
             * Row and Column Handling
             */

            insertRowBefore.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    model.insertRow(mouseRow);
                }
            });

            insertRowAfter.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    model.insertRow(mouseRow + 1);
                }
            });

            removeRow.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    model.removeRow(mouseRow);
                }
            });


            insertColumnBefore.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    model.insertColumn(mouseColumn);
                }
            });

            insertColumnAfter.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    model.insertColumn(mouseColumn + 1);
                }
            });

            removeColumn.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    model.removeColumn(mouseColumn);
                }
            });

            /*
             * Setup Menu
             */

            this.add(addMenu);
            this.add(removeInstrumentMenuItem);
            this.addSeparator();
            this.add(cutMenuItem);
            this.add(copyMenuItem);
            this.add(pasteMenuItem);
            this.addSeparator();
            this.add(insertRowBefore);
            this.add(insertRowAfter);
            this.add(removeRow);
            this.addSeparator();
            this.add(insertColumnBefore);
            this.add(insertColumnAfter);
            this.add(removeColumn);

            setupPopupListener();
        }

        private void setupPopupListener() {
            this.addPopupMenuListener(new PopupMenuListener() {

                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                            mouseRow, mouseColumn);

                    boolean objectAvailable = (lObj != null);

                    cutMenuItem.setEnabled(objectAvailable);
                    copyMenuItem.setEnabled(objectAvailable);
                    removeInstrumentMenuItem.setEnabled(objectAvailable);

                    removeRow.setEnabled(liveObjectsTable.getRowCount() > 1);
                    removeColumn.setEnabled(
                            liveObjectsTable.getColumnCount() > 1);

                    if (!objectAvailable && buffer.hasBufferedSoundObject()) {
                        pasteMenuItem.setEnabled(plugins.contains(
                                buffer.getBufferedSoundObject().getClass()));
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
