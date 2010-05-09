package blue.soundObject.editor;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.BorderFactory;
import javax.swing.InputMap;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.event.UndoableEditEvent;
import javax.swing.event.UndoableEditListener;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;

import blue.BlueSystem;
import blue.gui.BlueEditorPane;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.soundObject.External;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.undo.NoStyleChangeUndoManager;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 *
 * @author unascribed
 * @version 1.0
 */

public class ExternalEditor extends SoundObjectEditor {

    External external;

    JLabel editorLabel = new JLabel();

    BlueEditorPane scoreEditPane = new BlueEditorPane();

    JPanel commandPanel = new JPanel();

    JLabel commandLabel = new JLabel(BlueSystem
            .getString("programOptions.commandLine")
            + " ");

    JButton testButton = new JButton(BlueSystem.getString("common.test"));

    JTextField commandText = new JTextField();

    UndoManager undo = new NoStyleChangeUndoManager();

    private boolean isUpdating = false;

    public ExternalEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        editorLabel.setText(BlueSystem.getString("externalObject.title"));
        editorLabel.setBorder(BorderFactory.createEmptyBorder(0, 0, 5, 0));

        this.setLayout(new BorderLayout());

        scoreEditPane.setEditable(true);
        scoreEditPane.setSyntaxSettable(true);
        scoreEditPane.addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (isUpdating) {
                    return;
                }

                if (evt.getPropertyName().equals("syntaxType")) {
                    String type = (String) evt.getNewValue();
                    external.setSyntaxType(type);
                }
            }

        });

        scoreEditPane.getDocument().addDocumentListener(new DocumentListener() {

            public void insertUpdate(DocumentEvent e) {
                if (external != null) {
                    external.setText(scoreEditPane.getText());
                }
            }

            public void removeUpdate(DocumentEvent e) {
                if (external != null) {
                    external.setText(scoreEditPane.getText());
                }
            }

            public void changedUpdate(DocumentEvent e) {
                if (external != null) {
                    external.setText(scoreEditPane.getText());
                }
            }
        });

        commandText.getDocument().addDocumentListener(new DocumentListener() {

            public void insertUpdate(DocumentEvent e) {
                if (external != null) {
                    external.setCommandLine(commandText.getText());
                }
            }

            public void removeUpdate(DocumentEvent e) {
                if (external != null) {
                    external.setCommandLine(commandText.getText());
                }
            }

            public void changedUpdate(DocumentEvent e) {
                if (external != null) {
                    external.setCommandLine(commandText.getText());
                }
            }
        });

        commandPanel.setLayout(new BorderLayout());
        commandPanel.add(commandLabel, BorderLayout.WEST);
        commandPanel.add(commandText, BorderLayout.CENTER);
        commandPanel.add(testButton, BorderLayout.EAST);
        commandPanel.add(editorLabel, BorderLayout.NORTH);
        commandPanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 5, 0));
        this.add(commandPanel, BorderLayout.NORTH);
        this.add(scoreEditPane, BorderLayout.CENTER);

        testButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }
        });

        initActions();

        undo.setLimit(1000);
    }

    private void initActions() {

        InputMap inputMap = scoreEditPane.getInputMap();
        ActionMap actions = scoreEditPane.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_T, BlueSystem
                .getMenuShortcutKey()), "testSoundObject");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_Z, BlueSystem
                .getMenuShortcutKey()), "undo");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_Z, BlueSystem
                .getMenuShortcutKey()
                | KeyEvent.SHIFT_DOWN_MASK), "redo");

        actions.put("testSoundObject", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }

        });

        actions.put("undo", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (undo.canUndo()) {
                    undo.undo();
                }
            }

        });

        actions.put("redo", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (undo.canRedo()) {
                    undo.redo();
                }
            }

        });

    }

    public final void editSoundObject(SoundObject sObj) {
        if (sObj == null) {
            external = null;
            return;
        }
        if (!sObj.getClass().getName().equals("blue.soundObject.External")) {
            external = null;
            return;
        }

        isUpdating = true;

        this.external = (External) sObj;

        scoreEditPane.setSyntaxType(external.getSyntaxType());

        scoreEditPane.setText(this.external.getText());
        commandText.setText(this.external.getCommandLine());

        scoreEditPane.getDocument().addUndoableEditListener(
                new UndoableEditListener() {

                    public void undoableEditHappened(UndoableEditEvent e) {
                        UndoableEdit edit = e.getEdit();
                        undo.addEdit(edit);

                    }
                });

        undo.discardAllEdits();

        isUpdating = false;
    }

    public final void testSoundObject() {
        if (this.external == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = this.external.generateNotes(0.0f, -1.0f);
        } catch (SoundObjectException e) {
            ExceptionDialog
                    .showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                            .getString("soundObject.generatedScore"));
        }

    }

}