package blue.soundObject.editor;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.util.HashMap;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.BorderFactory;
import javax.swing.InputMap;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.event.UndoableEditEvent;
import javax.swing.event.UndoableEditListener;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;

import org.syntax.jedit.tokenmarker.JavaScriptTokenMarker;
import org.syntax.jedit.tokenmarker.PythonTokenMarker;
import org.syntax.jedit.tokenmarker.TokenMarker;

import blue.BlueSystem;
import blue.gui.BlueEditorPane;
import blue.gui.CsoundTokenMarker;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.soundObject.GenericEditable;
import blue.soundObject.GenericScore;
import blue.soundObject.NoteList;
import blue.soundObject.PythonObject;
import blue.soundObject.RhinoObject;
import blue.soundObject.Sound;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.undo.NoStyleChangeUndoManager;
import org.openide.util.Exceptions;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

public class GenericEditor extends SoundObjectEditor {

    private static HashMap tokenMarkerTypes = new HashMap();

    static {
        tokenMarkerTypes.put(GenericScore.class, new CsoundTokenMarker());
        tokenMarkerTypes.put(Sound.class, new CsoundTokenMarker());
        tokenMarkerTypes.put(PythonObject.class, new PythonTokenMarker());
        tokenMarkerTypes.put(RhinoObject.class, new JavaScriptTokenMarker());
    }

    GenericEditable sObj;

    BlueEditorPane scoreEditPane = new BlueEditorPane();

    JLabel editorLabel = new JLabel();

    JPanel topPanel = new JPanel();

    JButton testButton = new JButton();

    UndoManager undo = new NoStyleChangeUndoManager();

    public GenericEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        scoreEditPane.getDocument().addDocumentListener(new DocumentListener() {

            public void insertUpdate(DocumentEvent e) {
                if (sObj != null) {
                    sObj.setText(scoreEditPane.getText());
                }
            }

            public void removeUpdate(DocumentEvent e) {
                if (sObj != null) {
                    sObj.setText(scoreEditPane.getText());
                }
            }

            public void changedUpdate(DocumentEvent e) {
                if (sObj != null) {
                    sObj.setText(scoreEditPane.getText());
                }
            }
        });

        // scoreEditPane.addKeyboardAction(new KeyStrokeAction(KeyStroke
        // .getKeyStroke(KeyEvent.VK_T, BlueSystem.MENU_SHORTCUT_KEY)) {
        // public void actionPerformed(ActionEvent e) {
        // testSoundObject();
        // }
        // });
        //
        // scoreEditPane.addKeyboardAction(new KeyStrokeAction(KeyStroke
        // .getKeyStroke(KeyEvent.VK_Z, BlueSystem.MENU_SHORTCUT_KEY)) {
        // public void actionPerformed(ActionEvent e) {
        // if (undo.canUndo()) {
        // undo.undo();
        // }
        // }
        // });
        //
        // scoreEditPane.addKeyboardAction(new KeyStrokeAction(KeyStroke
        // .getKeyStroke(KeyEvent.VK_Z, BlueSystem.MENU_SHORTCUT_KEY
        // | KeyEvent.SHIFT_DOWN_MASK)) {
        // public void actionPerformed(ActionEvent e) {
        // if (undo.canRedo()) {
        // undo.redo();
        // }
        // }
        // });

        initActions();

        editorLabel.setText("generic editor");

        testButton.setText(BlueSystem.getString("common.test"));
        testButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }
        });

        topPanel.setLayout(new BorderLayout());
        topPanel.add(editorLabel, BorderLayout.CENTER);
        topPanel.add(testButton, BorderLayout.EAST);

        this.add(scoreEditPane, BorderLayout.CENTER);
        this.add(topPanel, BorderLayout.NORTH);

        scoreEditPane.getDocument().addUndoableEditListener(
                new UndoableEditListener() {

                    public void undoableEditHappened(UndoableEditEvent e) {
                        UndoableEdit edit = e.getEdit();
                        undo.addEdit(edit);

                    }
                });

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
            this.sObj = null;
            editorLabel.setText("no editor available");
            scoreEditPane.setText("null soundObject");
            scoreEditPane.setEnabled(false);
            return;
        }

        if (!(sObj instanceof GenericEditable)) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            scoreEditPane
                    .setText("[ERROR] GenericEditor::editSoundObject - not instance of GenericEditable");
            scoreEditPane.setEnabled(false);
            return;
        }

        Object marker = tokenMarkerTypes.get(sObj.getClass());

        scoreEditPane.setTokenMarker((TokenMarker) marker);

        editorLabel.setText("Generic Editor - Type: "
                + sObj.getClass().getName());

        this.sObj = (GenericEditable) sObj;
        scoreEditPane.setText(this.sObj.getText());
        scoreEditPane.setEnabled(true);
        scoreEditPane.setCaretPosition(0);

        undo.discardAllEdits();
    }

    public final void testSoundObject() {
        if (this.sObj == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = ((SoundObject) this.sObj).generateForCSD(null, 0.0f, -1.0f);
        } catch (Exception e) {
            ExceptionDialog.showExceptionDialog(this, e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                            .getString("soundObject.generatedScore"));
        }
    }
}