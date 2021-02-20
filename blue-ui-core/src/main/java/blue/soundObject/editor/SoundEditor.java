/*
 * blue - object composition environment for csound Copyright (c) 2001-2017
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
package blue.soundObject.editor;

import blue.Arrangement;
import blue.BlueSystem;
import blue.CompileData;
import blue.Tables;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.soundObject.NoteList;
import blue.soundObject.Sound;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.sound.AutomationPanel;
import blue.ui.core.orchestra.editor.BlueSynthBuilderEditor;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import java.awt.BorderLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

/**
 * Editor for Sound SoundObject.
 *
 * @author steven yi
 * @version 1.0
 */
@ScoreObjectEditorPlugin(scoreObjectType = Sound.class)
public class SoundEditor extends ScoreObjectEditor {

    Sound sObj;

    JLabel editorLabel = new JLabel();

    JPanel topPanel = new JPanel();

    JButton testButton = new JButton();


    BlueSynthBuilderEditor editor = new BlueSynthBuilderEditor();

    AutomationPanel automationPanel = new AutomationPanel();

    MimeTypeEditorComponent commentPane = new MimeTypeEditorComponent("text/plain");
    public SoundEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {

        this.setLayout(new BorderLayout());
        this.add(editor);
        editor.setLabelText("[ Sound ]");
        editor.getTabs().insertTab("Automation", null, automationPanel, "", 1);
        editor.getTabs().addTab("Comments", commentPane);

        commentPane.getDocument().addDocumentListener(new DocumentListener() {
            @Override
            public void insertUpdate(DocumentEvent e) {
                updateComment();
            }

            @Override
            public void removeUpdate(DocumentEvent e) {
                updateComment();
            }

            @Override
            public void changedUpdate(DocumentEvent e) {
                updateComment();
            }

            private void updateComment() {
                if (sObj != null) {
                    sObj.setComment(commentPane.getText());
                }
            }
        });
    }

    @Override
    public final void editScoreObject(ScoreObject sObj) {

        if (sObj == null || !(sObj instanceof Sound)) {
            this.sObj = null;
            editorLabel.setText("no editor available");
            editor.editInstrument(null);

            return;
        }

        this.sObj = null;

        commentPane.setText(((Sound) sObj).getComment());
        commentPane.getJEditorPane().setCaretPosition(0);
        commentPane.resetUndoManager();

        this.sObj = (Sound) sObj;
        editor.editInstrument(this.sObj.getBlueSynthBuilder());
        automationPanel.editSound(this.sObj);

    }

    public final void testSoundObject() {
        if (this.sObj == null) {
            return;
        }

        NoteList notes = null;

        try {
            notes = ((SoundObject) this.sObj).generateForCSD(new CompileData(new Arrangement(), new Tables()), 0.0f, -1.0f);
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
