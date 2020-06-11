package blue.soundObject.editor;

import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.Comment;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.BorderLayout;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
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
@ScoreObjectEditorPlugin(scoreObjectType = Comment.class)
public class CommentEditor extends ScoreObjectEditor {

    Comment sObj;

    MimeTypeEditorComponent scoreEditPane = new MimeTypeEditorComponent("text/plain");

    JLabel editorLabel = new JLabel();

    JPanel topPanel = new JPanel();

//    JButton testButton = new JButton();

    UndoManager undo = new UndoRedo.Manager();

    public CommentEditor() {
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

        editorLabel.setText("Comment");

        topPanel.setLayout(new BorderLayout());
        topPanel.add(editorLabel, BorderLayout.CENTER);

        this.add(scoreEditPane, BorderLayout.CENTER);
        this.add(topPanel, BorderLayout.NORTH);

        scoreEditPane.getDocument().addUndoableEditListener(undo);
        scoreEditPane.setUndoManager(undo);

        undo.setLimit(1000);
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

        if (!(sObj instanceof Comment)) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            scoreEditPane
                    .setText("[ERROR] GenericEditor::editSoundObject - not instance of GenericEditable");
            scoreEditPane.getJEditorPane().setEnabled(false);
            return;
        }

        this.sObj = (Comment) sObj;
        scoreEditPane.setText(this.sObj.getText());
        scoreEditPane.getJEditorPane().setEnabled(true);
        scoreEditPane.getJEditorPane().setCaretPosition(0);
        scoreEditPane.resetUndoManager();

        undo.discardAllEdits();
    }

}