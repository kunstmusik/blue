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

import blue.BlueSystem;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.soundObject.pianoRoll.PianoNote;
import java.awt.BorderLayout;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

/**
 * @author steven
 */
public class NotePropertiesEditor extends JPanel implements
        SelectionListener<PianoNoteView>, PropertyChangeListener {

    PianoNote note = null;

    JTextField noteTemplateText = new JTextField();

    JLabel label = new JLabel(BlueSystem.getString("pianoRoll.noteTemplate"));

    // JTextField noteStartText = new JTextField();
    // JTextField noteDurationText = new JTextField();
    private boolean isUpdating = false;

    public NotePropertiesEditor() {
        this.setLayout(new BorderLayout(5, 5));

        // this.setBorder(BorderFactory.createTitledBorder("Note Properties"));
        // this.setBorder(BorderFactory.createEmptyBorder(5,5,5,5));
        label.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 0));
        noteTemplateText.setBorder(
                BorderFactory.createCompoundBorder(
                        BorderFactory.createEmptyBorder(5, 5, 5, 5),
                        noteTemplateText.getBorder()));

        add(label, BorderLayout.WEST);
        add(noteTemplateText, BorderLayout.CENTER);
//        addItem(BlueSystem.getString("pianoRoll.noteTemplate"),
//                noteTemplateText);
        // addItem("Note Start: ", noteStartText);
        // addItem("Note Duration: ", noteDurationText);

        noteTemplateText.getDocument().addDocumentListener(
                new DocumentListener() {

                    @Override
                    public void insertUpdate(DocumentEvent e) {
                        updateNoteTemplate();
                    }

                    @Override
                    public void removeUpdate(DocumentEvent e) {
                        updateNoteTemplate();
                    }

                    @Override
                    public void changedUpdate(DocumentEvent e) {
                        updateNoteTemplate();
                    }

                    private void updateNoteTemplate() {
                        if (note != null && !isUpdating) {
                            note.setNoteTemplate(noteTemplateText.getText());
                        }
                    }

                });

        // noteStartText.addActionListener(new ActionListener() {
        //
        // public void actionPerformed(ActionEvent e) {
        // /*if(note != null && !isUpdating) {
        //
        // }*/
        // }
        //
        // });
    }

    @Override
    public void selectionPerformed(SelectionEvent<PianoNoteView> e) {
        isUpdating = true;

        switch (e.getSelectionType()) {
            case SelectionEvent.SELECTION_SINGLE:
                PianoNoteView noteView = e.getSelectedItem();

                // if(note != null) {
                // note.removePropertyChangeListener(this);
                // }
                note = noteView.getPianoNote();

                // note.addPropertyChangeListener(this);
                noteTemplateText.setEditable(true);
                // noteStartText.setEditable(true);
                // noteDurationText.setEditable(true);
                noteTemplateText.setText(note.getNoteTemplate());
                // noteStartText.setText(Float.toString(note.getStart()));
                // noteDurationText.setText(Float.toString(note.getDuration()));
                break;
            case SelectionEvent.SELECTION_ADD:
            case SelectionEvent.SELECTION_CLEAR:
                // if(note != null) {
                // note.removePropertyChangeListener(this);
                // }

                note = null;
                noteTemplateText.setEditable(false);
                // noteStartText.setEditable(false);
                // noteDurationText.setEditable(false);
                noteTemplateText.setText("");
                // noteStartText.setText("");
            // noteDurationText.setText("");
        }

        isUpdating = false;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        // if(evt.getSource() == note) {
        // if(evt.getPropertyName().equals("start")) {
        // noteStartText.setText(Float.toString(note.getStart()));
        // } else if(evt.getPropertyName().equals("duration")) {
        // noteDurationText.setText(Float.toString(note.getDuration()));
        // }
        // }
    }

}
