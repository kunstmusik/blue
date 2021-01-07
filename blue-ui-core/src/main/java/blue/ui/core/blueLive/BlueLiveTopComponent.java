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
import blue.blueLive.LiveObjectBins;
import blue.blueLive.LiveObjectSet;
import blue.blueLive.LiveObjectSetList;
import blue.midi.*;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObject;
import blue.soundObject.TimeBehavior;
import blue.ui.core.clipboard.BlueClipboardUtils;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreObjectCopy;
import blue.ui.core.score.layers.SoundObjectProvider;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.nbutilities.lazyplugin.AttributeFilter;
import blue.ui.nbutilities.lazyplugin.LazyPlugin;
import blue.ui.nbutilities.lazyplugin.LazyPluginFactory;
import blue.ui.utilities.SimpleDocumentListener;
import blue.ui.utilities.UiUtilities;
import blue.utility.ScoreUtilities;
import java.awt.BorderLayout;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;
import java.awt.event.*;
import java.beans.PropertyChangeEvent;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.Receiver;
import javax.swing.*;
import javax.swing.event.DocumentEvent;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.text.BadLocationException;
import javax.swing.text.Document;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.Exceptions;
import org.openide.util.NbBundle;
import org.openide.util.lookup.AbstractLookup;
import org.openide.util.lookup.InstanceContent;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
import skt.swing.SwingUtil;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(dtd = "-//blue.ui.core.blueLive//BlueLive//EN",
        autostore = false)
@TopComponent.Description(
        preferredID = "BlueLiveTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "editor", openAtStartup = true,
        position = 800)
@ActionID(category = "Window", id = "blue.ui.core.blueLive.BlueLiveTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 1700, separatorAfter = 1750),
    @ActionReference(path = "Shortcuts", name = "D-8")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_BlueLiveAction",
        preferredID = "BlueLiveTopComponent"
)
@NbBundle.Messages({
    "CTL_BlueLiveAction=BlueLive",
    "CTL_BlueLiveTopComponent=BlueLive",
    "HINT_BlueLiveTopComponent=This is a BlueLive window"
})
public final class BlueLiveTopComponent extends TopComponent
        implements SoundObjectProvider {

    private static BlueLiveTopComponent instance;

    private final InstanceContent content = new InstanceContent();

    /**
     * path to the icon used by the component and its open action
     */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "BlueLiveTopComponent";
    BlueData data = null;
    LiveObjectsTableModel model;
    LiveObjectSetListTableModel setModel;
    BufferMenu bufferPopup;
    SetsBufferMenu setsBufferPopup;
    MidiInputManager midiManager;
    ScoPadReceiver scoPadReceiver = new ScoPadReceiver();
    JPopupMenu noteTemplatePopup;
    int mouseColumn = -1;
    int mouseRow = -1;

    MimeTypeEditorComponent liveCodeEditor
            = new MimeTypeEditorComponent("text/x-csound-orc");

    Map<Class<? extends SoundObject>, String> liveSoundObjectTemplates;

    CompileData compileData = CompileData.createEmptyCompileData();

    public BlueLiveTopComponent() {

        List<LazyPlugin<SoundObject>> plugins = LazyPluginFactory.loadPlugins(
                "blue/score/soundObjects", SoundObject.class,
                new AttributeFilter("live"));

        liveSoundObjectTemplates = new HashMap<>();

        for (LazyPlugin<SoundObject> plugin : plugins) {
            liveSoundObjectTemplates.put(
                    plugin.getInstance().getClass(),
                    plugin.getDisplayName());
        }

        initComponents();

        associateLookup(new AbstractLookup(content));

        setName(NbBundle.getMessage(BlueLiveTopComponent.class,
                "CTL_BlueLiveTopComponent"));
        setToolTipText(NbBundle.getMessage(BlueLiveTopComponent.class,
                "HINT_BlueLiveTopComponent"));
//        setIcon(ImageUtilities.loadImage(ICON_PATH, true));

        setupNoteTemplatePopup();

        model = new LiveObjectsTableModel();
        setModel = new LiveObjectSetListTableModel();
        final LiveObjectRenderer liveObjectRenderer = new LiveObjectRenderer();

        liveObjectsTable.setDefaultRenderer(LiveObject.class, liveObjectRenderer);

        liveObjectsTable.setModel(model);
        liveObjectsTable.setRowHeight(24);
        liveObjectsTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        liveObjectsTable.getSelectionModel().addListSelectionListener(
                (ListSelectionEvent e) -> {
                    if (!e.getValueIsAdjusting()) {
                        if (data == null) {
                            return;
                        }
                        int row = liveObjectsTable.getSelectedRow();
                        int column = liveObjectsTable.getSelectedColumn();

                        final LiveObject lObj = (LiveObject) model.getValueAt(
                                row, column);

                        if (lObj != null) {
                            SwingUtilities.invokeLater(() -> {
                                content.set(Collections.singleton(
                                        lObj.getSoundObject()), null);
                            });
                        } else {
                            SwingUtilities.invokeLater(() -> {
                                content.set(Collections.emptyList(), null);
                            });
                        }

                    }
                });

        liveObjectsTable.addMouseListener(new MouseAdapter() {

            @Override
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

        liveObjectSetListTable.setModel(setModel);
        liveObjectSetListTable.setRowHeight(24);
        liveObjectSetListTable.setSelectionMode(
                ListSelectionModel.SINGLE_SELECTION);

        liveObjectSetListTable.getSelectionModel().addListSelectionListener(
                (ListSelectionEvent e) -> {
                    if (!e.getValueIsAdjusting()) {
                        if (data == null) {
                            return;
                        }

                        int row = liveObjectSetListTable.getSelectedRow();

                        if (row < 0) {
                            return;
                        }

                        final LiveObjectSet lObjSet = data.getLiveData().getLiveObjectSets().get(
                                row);

                        if (lObjSet != null) {
                            model.setEnabled(lObjSet);
                        }

                    }
                });

        liveObjectSetListTable.addMouseMotionListener(new MouseMotionAdapter() {

            @Override
            public void mouseMoved(MouseEvent e) {
                int row = liveObjectSetListTable.rowAtPoint(e.getPoint());

                if (row < setModel.getRowCount()) {
                    final LiveObjectSet lObjSet = data.getLiveData().getLiveObjectSets().get(
                            row);

                    liveObjectRenderer.setLiveObjectSet(lObjSet);

                    if (lObjSet != null) {
                        liveObjectsTable.repaint();
                    }
                }
            }

        });

        liveObjectSetListTable.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseExited(MouseEvent e) {
                liveObjectRenderer.setLiveObjectSet(null);
                liveObjectsTable.repaint();
            }

            @Override
            public void mousePressed(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)) {
                    if (setsBufferPopup == null) {
                        setsBufferPopup = new SetsBufferMenu();
                    }
                    mouseRow = liveObjectSetListTable.rowAtPoint(e.getPoint());
                    mouseColumn = liveObjectSetListTable.columnAtPoint(
                            e.getPoint());
                    setsBufferPopup.show(liveObjectSetListTable, e.getX(),
                            e.getY());
                }
            }

        });

        commandLineText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

            @Override
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

            @Override
            public void send(MidiMessage message, long timeStamp) {
                if (jTabbedPane1.getSelectedIndex() != 0) {
                    return;
                }
            }

            @Override
            public void close() {
            }
        });

        // receiver for SCO pad tab
        midiManager.addReceiver(scoPadReceiver);

        startSpinner.setModel(new SpinnerNumberModel(0.0, 0.0,
                Double.POSITIVE_INFINITY, 1.0));
        quarterNoteSpinner.setModel(new SpinnerNumberModel(1.0, 0.0,
                Double.POSITIVE_INFINITY, 1.0));

        BlueProjectManager.getInstance().addPropertyChangeListener(
                (PropertyChangeEvent evt) -> {
                    if (BlueProjectManager.CURRENT_PROJECT.equals(
                            evt.getPropertyName())) {
                        reinitialize();
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
                KeyEvent.VK_T,
                BlueSystem.getMenuShortcutKey() | KeyEvent.SHIFT_DOWN_MASK));

        Action copyObj = new AbstractAction("copy-obj") {

            @Override
            public void actionPerformed(ActionEvent e) {

                LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                        liveObjectsTable.getSelectedRow(),
                        liveObjectsTable.getSelectedColumn());

                if (lObj != null) {
                    ScoreObject sObj = lObj.getSoundObject().deepCopy();
                    var copy = new ScoreObjectCopy(List.of(sObj), List.of(0));
                    var clipboard = BlueClipboardUtils.getClipboard();
                    clipboard.setContents(copy, new StringSelection(""));
                }
            }
        };
        copyObj.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                KeyEvent.VK_C, BlueSystem.getMenuShortcutKey()));

        Action pasteObj = new AbstractAction("paste-obj") {

            @Override
            public void actionPerformed(ActionEvent e) {
                final var scoreObjectBuffer
                        = BlueClipboardUtils.getScoreObjectCopy();

                if (scoreObjectBuffer == null || scoreObjectBuffer.scoreObjects.size() != 1) {
                    return;
                }
                ScoreObject scoreObj = scoreObjectBuffer.scoreObjects.get(0);
                if (!(scoreObj instanceof SoundObject)) {
                    return;
                }

                SoundObject sObj = (SoundObject) scoreObj;

                int row = liveObjectsTable.getSelectedRow();
                int column = liveObjectsTable.getSelectedColumn();

                if (sObj == null || !liveSoundObjectTemplates.containsKey(
                        sObj.getClass()) || row < 0 || column < 0) {
                    return;
                }

                SoundObject copy = sObj.deepCopy();
                copy.setStartTime(0.0f);

                addSoundObject(column, row, copy);
            }
        };

        pasteObj.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                KeyEvent.VK_V, BlueSystem.getMenuShortcutKey()));

        SwingUtil.installActions(liveObjectsTable,
                new Action[]{singleTrigger, multiTrigger, copyObj, pasteObj});

        liveCodeEditor.getDocument().addDocumentListener(new SimpleDocumentListener() {
            @Override
            public void documentChanged(DocumentEvent e) {
                if (data != null) {
                    data.getLiveData().setLiveCodeText(liveCodeEditor.getText());
                }
            }
        });
        liveCodeEditor.getJEditorPane().getInputMap().put(KeyStroke.getKeyStroke(KeyEvent.VK_E, BlueSystem.getMenuShortcutKey()), "eval-live-orc");
        liveCodeEditor.getJEditorPane().getActionMap().put("eval-live-orc",
                new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {

                String orc = liveCodeEditor.getJEditorPane().getSelectedText();
                RealtimeRenderManager.getInstance().evalOrc(orc);
            }
        });
        liveCodePanel.add(liveCodeEditor, BorderLayout.CENTER);
    }

    private void reinitialize() {
        this.data = null;
        this.compileData = CompileData.createEmptyCompileData();

        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData currentData = null;

        if (project != null) {
            currentData = project.getData();
        }

        if (currentData != null) {

            LiveData liveData = currentData.getLiveData();

            this.liveObjectsTable.setAutoCreateColumnsFromModel(true);
            model.setLiveObjectBins(liveData.getLiveObjectBins());
            setModel.setLiveObjectSetList(liveData.getLiveObjectSets());
            this.liveObjectsTable.setModel(model);
            this.liveObjectSetListTable.setModel(setModel);

            this.commandLineText.setText(liveData.getCommandLine());

            this.enableAdvancedFlags.setSelected(liveData.isCommandLineEnabled());
            this.completeOverride.setSelected(liveData.isCommandLineOverride());

            this.repeatButton.setSelected(liveData.isRepeatEnabled());

            commandLineText.setEnabled(liveData.isCommandLineEnabled());

//            liveObjectsTable.getColumnModel().getColumn(2).setMaxWidth(100);
//            liveObjectsTable.getColumnModel().getColumn(2).setMinWidth(100);
//            liveObjectsTable.getColumnModel().getColumn(2).setWidth(100);
            // csoundCommand.setText(data.getLiveData().getCommandLine());
            // liveSpace.setLiveObjects(data.getLiveData().getLiveSoundObjects());
            repeatSpinner.setValue(liveData.getRepeat());
            tempoSpinner.setValue(liveData.getTempo());

            liveCodeEditor.setText(liveData.getLiveCodeText());
            liveCodeEditor.getJEditorPane().setCaretPosition(0);
            liveCodeEditor.resetUndoManager();

            this.data = currentData;

            this.repaint();
        }

    }

    protected void triggerLiveObject(LiveObject liveObject) {
        NoteList nl = null;
        try {
            SoundObject sObj = liveObject.getSoundObject();

            if (sObj.getTimeBehavior() != TimeBehavior.NOT_SUPPORTED) {
                sObj.setTimeBehavior(TimeBehavior.NONE);
            }

            nl = sObj.generateForCSD(compileData, 0.0f, -1.0f);
        } catch (Exception e) {
            Exceptions.printStackTrace(e);
        }

        if (nl == null) {
            return;
        }

        int tempo = (Integer) tempoSpinner.getValue();

        ScoreUtilities.scaleScore(nl, 60.0f / tempo);

        String scoreText = nl.toString();
        if (scoreText != null && scoreText.length() > 0) {
            RealtimeRenderManager.getInstance().passToStdin(scoreText);
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
        triggerButton = new javax.swing.JButton();
        jLabel6 = new javax.swing.JLabel();
        tempoSpinner = new javax.swing.JSpinner();
        jLabel7 = new javax.swing.JLabel();
        repeatSpinner = new javax.swing.JSpinner();
        repeatButton = new javax.swing.JToggleButton();
        jSplitPane1 = new javax.swing.JSplitPane();
        jScrollPane1 = new javax.swing.JScrollPane();
        liveObjectsTable = new JTable() {      public boolean getScrollableTracksViewportHeight() {         return getPreferredSize().height < getParent().getHeight();     }      };
        jPanel2 = new javax.swing.JPanel();
        jScrollPane3 = new javax.swing.JScrollPane();
        liveObjectSetListTable = new javax.swing.JTable();
        bottomPanel = new javax.swing.JPanel();
        buttonUp = new javax.swing.JButton();
        buttonDown = new javax.swing.JButton();
        buttonAdd = new javax.swing.JButton();
        buttonRemove = new javax.swing.JButton();
        liveCodePanel = new javax.swing.JPanel();
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

        jSplitPane1.setDividerLocation(200);

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

        jSplitPane1.setRightComponent(jScrollPane1);

        jPanel2.setLayout(new java.awt.BorderLayout());

        liveObjectSetListTable.setModel(new javax.swing.table.DefaultTableModel(
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
        jScrollPane3.setViewportView(liveObjectSetListTable);

        jPanel2.add(jScrollPane3, java.awt.BorderLayout.CENTER);

        bottomPanel.setMaximumSize(new java.awt.Dimension(32767, 17));
        bottomPanel.setPreferredSize(new java.awt.Dimension(100, 17));
        bottomPanel.setLayout(new java.awt.GridLayout(1, 0));

        org.openide.awt.Mnemonics.setLocalizedText(buttonUp, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.buttonUp.text")); // NOI18N
        buttonUp.setFocusPainted(false);
        buttonUp.setFocusable(false);
        buttonUp.setMargin(new java.awt.Insets(0, 1, 0, 1));
        buttonUp.setMinimumSize(new java.awt.Dimension(15, 15));
        buttonUp.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                buttonUpActionPerformed(evt);
            }
        });
        bottomPanel.add(buttonUp);

        org.openide.awt.Mnemonics.setLocalizedText(buttonDown, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.buttonDown.text")); // NOI18N
        buttonDown.setFocusPainted(false);
        buttonDown.setFocusable(false);
        buttonDown.setMargin(new java.awt.Insets(0, 1, 1, 1));
        buttonDown.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                buttonDownActionPerformed(evt);
            }
        });
        bottomPanel.add(buttonDown);

        org.openide.awt.Mnemonics.setLocalizedText(buttonAdd, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.buttonAdd.text")); // NOI18N
        buttonAdd.setFocusPainted(false);
        buttonAdd.setFocusable(false);
        buttonAdd.setMargin(new java.awt.Insets(0, 1, 1, 1));
        buttonAdd.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                buttonAddActionPerformed(evt);
            }
        });
        bottomPanel.add(buttonAdd);

        org.openide.awt.Mnemonics.setLocalizedText(buttonRemove, org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.buttonRemove.text")); // NOI18N
        buttonRemove.setFocusPainted(false);
        buttonRemove.setFocusable(false);
        buttonRemove.setMargin(new java.awt.Insets(0, 1, 1, 1));
        buttonRemove.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                buttonRemoveActionPerformed(evt);
            }
        });
        bottomPanel.add(buttonRemove);

        jPanel2.add(bottomPanel, java.awt.BorderLayout.SOUTH);

        jSplitPane1.setLeftComponent(jPanel2);

        javax.swing.GroupLayout liveSpacePanelLayout = new javax.swing.GroupLayout(liveSpacePanel);
        liveSpacePanel.setLayout(liveSpacePanelLayout);
        liveSpacePanelLayout.setHorizontalGroup(
            liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, liveSpacePanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                    .addComponent(jSplitPane1, javax.swing.GroupLayout.PREFERRED_SIZE, 0, Short.MAX_VALUE)
                    .addGroup(javax.swing.GroupLayout.Alignment.LEADING, liveSpacePanelLayout.createSequentialGroup()
                        .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addGroup(liveSpacePanelLayout.createSequentialGroup()
                                .addGap(124, 124, 124)
                                .addComponent(jLabel7))
                            .addGroup(liveSpacePanelLayout.createSequentialGroup()
                                .addComponent(jLabel6)
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addComponent(tempoSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 69, javax.swing.GroupLayout.PREFERRED_SIZE)
                                .addGap(58, 58, 58)
                                .addComponent(repeatSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, 71, javax.swing.GroupLayout.PREFERRED_SIZE)))
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(repeatButton)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED, 138, Short.MAX_VALUE)
                        .addComponent(triggerButton)))
                .addContainerGap())
        );
        liveSpacePanelLayout.setVerticalGroup(
            liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(liveSpacePanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(liveSpacePanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.CENTER)
                    .addComponent(triggerButton)
                    .addComponent(repeatButton)
                    .addComponent(repeatSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(tempoSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                    .addComponent(jLabel7)
                    .addComponent(jLabel6, javax.swing.GroupLayout.PREFERRED_SIZE, 29, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jSplitPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 442, Short.MAX_VALUE)
                .addContainerGap())
        );

        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.liveSpacePanel.TabConstraints.tabTitle"), liveSpacePanel); // NOI18N

        liveCodePanel.setLayout(new java.awt.BorderLayout());
        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(BlueLiveTopComponent.class, "BlueLiveTopComponent.liveCodePanel.TabConstraints.tabTitle"), liveCodePanel); // NOI18N

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
                .addComponent(jScrollPane2, javax.swing.GroupLayout.DEFAULT_SIZE, 387, Short.MAX_VALUE)
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
                    .addComponent(commandLineText, javax.swing.GroupLayout.DEFAULT_SIZE, 440, Short.MAX_VALUE))
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
                .addContainerGap(431, Short.MAX_VALUE))
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
            .addGroup(layout.createSequentialGroup()
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

        double start = ((Double) startSpinner.getValue()).doubleValue();
        String template = noteTemplateText.getText();
        String instrId = instrIdText.getText();
        double quarterNote = ((Double) quarterNoteSpinner.getValue()).doubleValue();
        double dur = quarterNote * time;

        outputTextArea.setText(
                outputTextArea.getText() + scoPadReceiver.getNotes(
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

        LiveObjectSet liveObjects = data.getLiveData().getLiveObjectBins().getEnabledLiveObjectSet();

        if (liveObjects.size() > 0) {
            System.out.println("LiveObjectsSize: " + liveObjects.size());
            NoteList nl = new NoteList();
            try {

                for (LiveObject liveObj : liveObjects) {

                    SoundObject sObj = liveObj.getSoundObject();

                    if (sObj.getTimeBehavior() != TimeBehavior.NOT_SUPPORTED) {
                        sObj.setTimeBehavior(TimeBehavior.NONE);
                    }

                    nl.addAll(sObj.generateForCSD(compileData, 0.0f, -1.0f));
                }
            } catch (Exception e) {
                Exceptions.printStackTrace(e);
            }

            int tempo = (Integer) tempoSpinner.getValue();
            ScoreUtilities.scaleScore(nl, 60.0f / tempo);

            String scoreText = nl.toString();

            if (scoreText != null && scoreText.length() > 0) {
                RealtimeRenderManager.getInstance().passToStdin(scoreText);
            }

        }

    }//GEN-LAST:event_triggerButtonActionPerformed

    private void repeatButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_repeatButtonActionPerformed
//        if (!blueLiveToolBar.isRunning()) {
//            repeatButton.setSelected(false);
//            return;
//        }

//        if (repeatButton.isSelected()) {
//            if (performanceThread == null) {
//                performanceThread = new PerformanceThread();
//                performanceThread.start();
//            }
//        } else if (performanceThread != null) {
//            performanceThread.turnOff();
//            performanceThread = null;
//        }
        if (data != null) {
            data.getLiveData().setRepeatEnabled(repeatButton.isSelected());
        }
    }//GEN-LAST:event_repeatButtonActionPerformed

    private void tempoSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_tempoSpinnerStateChanged
        if (data == null) {
            return;
        }

        data.getLiveData().setTempo((Integer) tempoSpinner.getValue());
    }//GEN-LAST:event_tempoSpinnerStateChanged

    private void repeatSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {//GEN-FIRST:event_repeatSpinnerStateChanged
        if (data == null) {
            return;
        }

        data.getLiveData().setRepeat((Integer) repeatSpinner.getValue());
    }//GEN-LAST:event_repeatSpinnerStateChanged

    private void buttonUpActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_buttonUpActionPerformed
        int row = liveObjectSetListTable.getSelectedRow();
        if (row >= 1 && row < setModel.getRowCount()) {
            setModel.pushUpSet(row);
            liveObjectSetListTable.setRowSelectionInterval(row - 1, row - 1);
        }
    }//GEN-LAST:event_buttonUpActionPerformed

    private void buttonDownActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_buttonDownActionPerformed
        int row = liveObjectSetListTable.getSelectedRow();

        if (row >= 0 && row < setModel.getRowCount() - 1) {
            setModel.pushDownSet(row);
            liveObjectSetListTable.setRowSelectionInterval(row + 1, row + 1);
        }

    }//GEN-LAST:event_buttonDownActionPerformed

    private void buttonAddActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_buttonAddActionPerformed
        if (data != null) {
            LiveData liveData = data.getLiveData();
            LiveObjectBins bins = liveData.getLiveObjectBins();
            LiveObjectSetList sets = liveData.getLiveObjectSets();

            LiveObjectSet set = bins.getEnabledLiveObjectSet();

            if (set != null && set.size() > 0) {
                setModel.addLiveObjectSet(set);
            }
        }
    }//GEN-LAST:event_buttonAddActionPerformed

    private void buttonRemoveActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_buttonRemoveActionPerformed
        int row = liveObjectSetListTable.getSelectedRow();

        if (row >= 0 && row < setModel.getRowCount() - 1) {
            setModel.removeLiveObjectSet(row);
        }
    }//GEN-LAST:event_buttonRemoveActionPerformed

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JPanel bottomPanel;
    private javax.swing.JButton buttonAdd;
    private javax.swing.JButton buttonDown;
    private javax.swing.JButton buttonRemove;
    private javax.swing.JButton buttonUp;
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
    private javax.swing.JPanel jPanel2;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JScrollPane jScrollPane3;
    private javax.swing.JSplitPane jSplitPane1;
    private javax.swing.JTabbedPane jTabbedPane1;
    private javax.swing.JPanel liveCodePanel;
    private javax.swing.JTable liveObjectSetListTable;
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

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
    }

    private void setupNoteTemplatePopup() {
        noteTemplatePopup = new JPopupMenu();

        String[] items = {"<START>", "<DUR>", "<KEY>", "<KEY_CPS>",
            "<KEY_OCT>", "<KEY_PCH>", "<VELOCITY>", "<VELOCITY_AMP>"};

        final ActionListener al = (ActionEvent e) -> {
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
        };

        for (int i = 0; i < items.length; i++) {
            JMenuItem item = new JMenuItem(items[i]);
            item.addActionListener(al);
            noteTemplatePopup.add(item);
        }
    }

    protected void addSoundObject(int column, int row, SoundObject sObj) {
        model.setValueAt(new LiveObject(sObj), row, column);
        liveObjectsTable.setRowSelectionInterval(row, row);
        liveObjectsTable.setColumnSelectionInterval(column, column);
    }

    class AddMenu extends JMenu implements ActionListener {

        HashMap<String, Class> sObjNameClassMap = new HashMap<>();

        public AddMenu() {

            super("Add SoundObject");

            for (Map.Entry<Class<? extends SoundObject>, String> entry
                    : liveSoundObjectTemplates.entrySet()) {

                sObjNameClassMap.put(entry.getValue(), entry.getKey());

                JMenuItem temp = new JMenuItem();
                temp.setText(
                        BlueSystem.getString("soundLayerPopup.addNew") + " " + BlueSystem.getShortClassName(
                        entry.getValue()));
                temp.putClientProperty("sObjClass", entry.getKey());
                temp.setActionCommand(entry.getValue());
                temp.addActionListener(this);
                this.add(temp);
            }

        }

        @Override
        public void actionPerformed(ActionEvent ae) {

            try {

                Class c = (Class) ((JMenuItem) ae.getSource()).getClientProperty(
                        "sObjClass");
                SoundObject sObj = (SoundObject) c.newInstance();
                addSoundObject(mouseColumn, mouseRow, sObj);
            } catch (IllegalAccessException | InstantiationException cnfe) {
                JOptionPane.showMessageDialog(
                        null,
                        BlueSystem.getString(
                                "soundLayerPopup.soundObject.couldNotInstantiate") + "\n" + ae.getActionCommand());
            }
        }
    }

    class SetsBufferMenu extends JPopupMenu {

        Action renameAction;
        Action removeAction;

        public SetsBufferMenu() {
            renameAction = new AbstractAction("Rename") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    final LiveObjectSetList liveObjectSets = data.getLiveData().getLiveObjectSets();

                    if (mouseRow >= 0 && mouseRow < liveObjectSets.size()) {
                        LiveObjectSet set = liveObjectSets.get(mouseRow);
                        String retVal = JOptionPane.showInputDialog(
                                WindowManager.getDefault().getMainWindow(),
                                "Rename",
                                set.getName());

                        if (retVal != null) {
                            set.setName(retVal);
                            liveObjectSetListTable.repaint();
                        }
                    }
                }

            };

            removeAction = new AbstractAction("Remove") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    setModel.removeLiveObjectSet(mouseRow);
                }

            };
            this.add(renameAction);
            this.add(removeAction);
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
            removeInstrumentMenuItem.addActionListener((ActionEvent e) -> {
                LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                        mouseRow, mouseColumn);

                if (lObj != null) {
                    model.setValueAt(null, mouseRow, mouseColumn);
                    content.set(Collections.emptyList(), null);
                }
            });
            cutMenuItem.addActionListener((ActionEvent e) -> {
                LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                        mouseRow, mouseColumn);

                if (lObj != null) {

                    SoundObject sObj = lObj.getSoundObject().deepCopy();

                    var copy = new ScoreObjectCopy(List.of(sObj), List.of(0));
                    var clipboard = BlueClipboardUtils.getClipboard();
                    clipboard.setContents(copy, new StringSelection(""));

                    model.setValueAt(null, mouseRow, mouseColumn);
                    content.set(Collections.emptyList(), null);
                }
            });
            copyMenuItem.addActionListener((ActionEvent e) -> {
                LiveObject lObj = (LiveObject) liveObjectsTable.getValueAt(
                        mouseRow, mouseColumn);

                if (lObj != null) {

                    SoundObject sObj = lObj.getSoundObject().deepCopy();

                    var copy = new ScoreObjectCopy(List.of(sObj), List.of(0));
                    var clipboard = BlueClipboardUtils.getClipboard();
                    clipboard.setContents(copy, new StringSelection(""));

                }
            });
            pasteMenuItem.addActionListener((ActionEvent e) -> {
                var scoreObjectBuffer
                        = BlueClipboardUtils.getScoreObjectCopy();

                if (scoreObjectBuffer == null || scoreObjectBuffer.scoreObjects.size() != 1) {
                    return;
                }
                ScoreObject scoreObj = scoreObjectBuffer.scoreObjects.get(0);
                if (!(scoreObj instanceof SoundObject)) {
                    return;
                }

                SoundObject sObj = (SoundObject) scoreObj;

                if (!liveSoundObjectTemplates.containsKey(sObj.getClass())) {
                    return;
                }

                SoundObject copy = sObj.deepCopy();
                copy.setStartTime(0.0f);
                addSoundObject(mouseColumn, mouseRow, copy);
            });

            /*
             * Row and Column Handling
             */
            insertRowBefore.addActionListener((ActionEvent e) -> {
                model.insertRow(mouseRow);
            });

            insertRowAfter.addActionListener((ActionEvent e) -> {
                model.insertRow(mouseRow + 1);
            });

            removeRow.addActionListener((ActionEvent e) -> {
                model.removeRow(mouseRow);
            });

            insertColumnBefore.addActionListener((ActionEvent e) -> {
                model.insertColumn(mouseColumn);
            });

            insertColumnAfter.addActionListener((ActionEvent e) -> {
                model.insertColumn(mouseColumn + 1);
            });

            removeColumn.addActionListener((ActionEvent e) -> {
                model.removeColumn(mouseColumn);
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

                @Override
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

                    var buffer = BlueClipboardUtils.getScoreObjectCopy();

                    if (buffer != null && buffer.scoreObjects.size() == 1 && buffer.isOnlySoundObjects()) {
                        pasteMenuItem.setEnabled(
                                liveSoundObjectTemplates.containsKey(
                                        buffer.scoreObjects.get(0).getClass()));
                    } else {
                        pasteMenuItem.setEnabled(false);
                    }
                }

                @Override
                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuCanceled(PopupMenuEvent e) {
                }
            });

        }
    }
}
