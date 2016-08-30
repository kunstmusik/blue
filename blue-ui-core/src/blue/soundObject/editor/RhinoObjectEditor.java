package blue.soundObject.editor;

import blue.BlueSystem;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.RhinoObject;
import blue.soundObject.SoundObject;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
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
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

@ScoreObjectEditorPlugin(scoreObjectType = RhinoObject.class)
public class RhinoObjectEditor extends ScoreObjectEditor {

    RhinoObject sObj;

    MimeTypeEditorComponent scoreEditPane = new MimeTypeEditorComponent("text/javascript");

    JLabel editorLabel = new JLabel();

    JPanel topPanel = new JPanel();

    JButton testButton = new JButton();

    UndoManager undo = new UndoRedo.Manager();

    public RhinoObjectEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        
        scoreEditPane.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                 if (sObj != null) {
                    sObj.setText(scoreEditPane.getText());
                }
            }
        });

        initActions();

        editorLabel.setText("RhinoObject");

        testButton.setText(BlueSystem.getString("common.test"));
        testButton.addActionListener((ActionEvent e) -> {
            testSoundObject();
        });

        topPanel.setLayout(new BorderLayout());
        topPanel.add(editorLabel, BorderLayout.CENTER);
        topPanel.add(testButton, BorderLayout.EAST);

        this.add(scoreEditPane, BorderLayout.CENTER);
        this.add(topPanel, BorderLayout.NORTH);

        scoreEditPane.getDocument().addUndoableEditListener(undo);
        scoreEditPane.setUndoManager(undo);

        undo.setLimit(1000);
    }

    private void initActions() {
        InputMap inputMap = scoreEditPane.getInputMap();
        ActionMap actions = scoreEditPane.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_T, BlueSystem
                .getMenuShortcutKey()), "testSoundObject");

        actions.put("testSoundObject", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                testSoundObject();
            }

        });

    }

    @Override
    public final void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            scoreEditPane.setText("null soundObject");
            scoreEditPane.getJEditorPane().setEnabled(false);
            return;
        }

        if (!(sObj instanceof RhinoObject)) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            scoreEditPane
                    .setText("[ERROR] GenericEditor::editSoundObject - not instance of GenericEditable");
            scoreEditPane.getJEditorPane().setEnabled(false);
            return;
        }

        this.sObj = (RhinoObject) sObj;
        scoreEditPane.setText(this.sObj.getText());
        scoreEditPane.getJEditorPane().setEnabled(true);
        scoreEditPane.getJEditorPane().setCaretPosition(0);

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
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this), e);
        }

        if (notes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    notes.toString(), BlueSystem
                            .getString("soundObject.generatedScore"));
        }
    }
}