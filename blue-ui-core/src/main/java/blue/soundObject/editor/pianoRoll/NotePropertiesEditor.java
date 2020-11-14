/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.editor.pianoRoll;

import blue.soundObject.PianoRoll;
import blue.soundObject.editor.pianoRoll.undo.UndoablePropertyEdit;
import blue.soundObject.pianoRoll.PianoNote;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.BorderLayout;
import java.beans.PropertyChangeListener;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.BorderFactory;
import javax.swing.JCheckBox;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.event.DocumentEvent;
import javax.swing.undo.UndoManager;

/**
 * @author steven
 */
public class NotePropertiesEditor extends JPanel
        implements ListChangeListener<PianoNote> {

    ObjectProperty<PianoNote> selectedNote
            = new SimpleObjectProperty<PianoNote>();

    JTextField noteTemplateText = new JTextField();

    JCheckBox overrideNoteTemplate = new JCheckBox("Override Note Template");

    private boolean isUpdating = false;
    private final ObservableList<PianoNote> selectedNotes;
    private PianoRoll pianoRoll = null;
    private final UndoManager undoManager;

    PropertyChangeListener pcl = pce -> {
        if (!isUpdating && "noteTemplate".equals(pce.getPropertyName())) {
            resetEditor();
        }
    };

    public NotePropertiesEditor(ObservableList<PianoNote> selectedNotes,
            UndoManager undoManager) {

        this.selectedNotes = selectedNotes;
        this.undoManager = undoManager;
        selectedNotes.addListener(this);

        this.setLayout(new BorderLayout(5, 5));

        overrideNoteTemplate.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 0));
        overrideNoteTemplate.addChangeListener(ce -> {
            var selected = overrideNoteTemplate.isSelected();
            noteTemplateText.setEnabled(selected);

            if (!selected && !isUpdating) {
                final var note = selectedNote.get();
                if (note != null
                        && pianoRoll.getNoteTemplate().equals(note.getNoteTemplate())) {
                    isUpdating = true;

                    var oldVal = note.getNoteTemplate();

                    note.setNoteTemplate(null);

                    if (oldVal != null) {
                        var edit = new UndoablePropertyEdit<String>(
                                v -> note.setNoteTemplate(v),
                                oldVal,
                                null);
                        undoManager.addEdit(edit);
                    }
                    isUpdating = false;
                }
            }

        });
        noteTemplateText.setBorder(
                BorderFactory.createCompoundBorder(
                        BorderFactory.createEmptyBorder(5, 5, 5, 5),
                        noteTemplateText.getBorder()));

        add(overrideNoteTemplate, BorderLayout.WEST);
        add(noteTemplateText, BorderLayout.CENTER);

        noteTemplateText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                final var note = selectedNote.get();
                if (note != null && !isUpdating && overrideNoteTemplate.isSelected()) {
                    var template = noteTemplateText.getText();

                    if (pianoRoll.getNoteTemplate().equals(template)) {
                        template = null;
                    }
                    isUpdating = true;

                    var oldVal = note.getNoteTemplate();
                    note.setNoteTemplate(template);

                    var edit = new UndoablePropertyEdit<String>(
                            v -> note.setNoteTemplate(v),
                            oldVal,
                            template);
                    undoManager.addEdit(edit);
                    isUpdating = false;
                }
            }

        });

        selectedNote.addListener((obs, old, newVal) -> {
            if (old != null) {
                old.removePropertyChangeListener(pcl);
            }
            if (newVal != null) {
                newVal.addPropertyChangeListener(pcl);
            }
        });
    }

    public void editPianoRoll(PianoRoll pianoRoll) {
        if (this.pianoRoll != null) {
            this.pianoRoll.removePropertyChangeListener(pcl);
        }

        this.pianoRoll = pianoRoll;

        if (this.pianoRoll != null) {
            this.pianoRoll.addPropertyChangeListener(pcl);
        }

        selectedNote.set(null);
        resetEditor();
    }

    @Override
    public void onChanged(Change<? extends PianoNote> change) {
        final var note = (selectedNotes.size() == 1 && pianoRoll != null)
                ? selectedNotes.get(0)
                : null;

        selectedNote.set(note);

        resetEditor();
    }

    protected void resetEditor() {
        if(isUpdating) {
            return;
        }
        final var note = selectedNote.get();

        isUpdating = true;
        if (note != null && pianoRoll != null) {
            var noteTemplate = note.getNoteTemplate();

            overrideNoteTemplate.setSelected(noteTemplate != null);
            noteTemplateText.setEnabled(noteTemplate != null);

            noteTemplateText.setText(noteTemplate == null
                    ? pianoRoll.getNoteTemplate() : noteTemplate);
            overrideNoteTemplate.setEnabled(true);
        } else {
            overrideNoteTemplate.setSelected(false);
            overrideNoteTemplate.setEnabled(false);
            noteTemplateText.setEnabled(false);
            noteTemplateText.setText("");
        }
        isUpdating = false;
    }

}
