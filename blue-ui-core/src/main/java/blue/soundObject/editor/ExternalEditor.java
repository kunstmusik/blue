package blue.soundObject.editor;

import blue.BlueSystem;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.External;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObjectException;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
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
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

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
@ScoreObjectEditorPlugin(scoreObjectType = External.class)
public class ExternalEditor extends ScoreObjectEditor {

    External external;

    JLabel editorLabel = new JLabel();

    MimeTypeEditorComponent score1EditPane = new MimeTypeEditorComponent("text/plain");

    JPanel commandPanel = new JPanel();

    JLabel commandLabel = new JLabel(BlueSystem
            .getString("programOptions.commandLine")
            + " ");

    JButton testButton = new JButton(BlueSystem.getString("common.test"));

    JTextField commandText = new JTextField();

    UndoManager undo = new UndoRedo.Manager();

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

        score1EditPane.getJEditorPane().setEditable(true);
        score1EditPane.setUndoManager(undo);
        score1EditPane.getDocument().addUndoableEditListener(undo);
        score1EditPane.addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (isUpdating) {
                return;
            }

            if (evt.getPropertyName().equals("syntaxType")) {
                String type = (String) evt.getNewValue();
                external.setSyntaxType(type);
            }
        });

        score1EditPane.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                if (external != null) {
                    external.setText(score1EditPane.getText());
                }
            }
        });

        commandText.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
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
        this.add(score1EditPane, BorderLayout.CENTER);

        testButton.addActionListener((ActionEvent e) -> {
            testSoundObject();
        });

        initActions();

        undo.setLimit(1000);
    }

    private void initActions() {

        InputMap inputMap = score1EditPane.getInputMap();
        ActionMap actions = score1EditPane.getActionMap();

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
            external = null;
            return;
        }
        if (!sObj.getClass().getName().equals("blue.soundObject.External")) {
            external = null;
            return;
        }

        isUpdating = true;

        this.external = (External) sObj;

        //FIXME - need to implement updatable syntax editing here...
//        scoreEditPane.setSyntaxType(external.getSyntaxType());

        score1EditPane.setText(this.external.getText());
        commandText.setText(this.external.getCommandLine());

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