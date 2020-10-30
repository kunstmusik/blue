/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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
import blue.soundObject.editor.pianoRoll.undo.FieldsEdit;
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.PianoNote;
import blue.ui.utilities.UiUtilities;
import blue.utilities.scales.ScaleLinear;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javafx.beans.property.ObjectProperty;
import javafx.collections.ObservableList;
import javax.swing.AbstractAction;
import javax.swing.JPopupMenu;
import javax.swing.undo.UndoManager;

/**
 *
 * @author stevenyi
 */
public class FieldEditorMouseListener extends MouseAdapter {

    private final ObservableList<PianoNote> selectedNotes;
    private final ScaleLinear yScale;

    private double[] originalValues = null;
    private Field[] affectedFields = null;

    private double startValue = 0.0;
    private Pin currentPin = null;
    private final ObjectProperty<FieldDef> selectedFieldDef;
    private final ObjectProperty<PianoRoll> currentPianoRoll;
    private final UndoManager undoManager;

    public FieldEditorMouseListener(ObjectProperty<PianoRoll> currentPianoRoll,
            ObservableList<PianoNote> selectedNotes,
            ObjectProperty<FieldDef> selectedFieldDef,
            ScaleLinear yScale, UndoManager undoManager) {
        this.currentPianoRoll = currentPianoRoll;
        this.selectedNotes = selectedNotes;
        this.selectedFieldDef = selectedFieldDef;
        this.yScale = yScale;
        this.undoManager = undoManager;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        var fEditor = (FieldEditor) e.getComponent();
        fEditor.requestFocus();

        if (UiUtilities.isRightMouseButton(e)) {
            showPopup(fEditor, e);
            e.consume();
            return;
        }

        var comp = fEditor.getComponentAt(e.getPoint());

        if (comp instanceof Pin) {

            var src = (Pin) comp;
            currentPin = src;

            if (selectedNotes.contains(src.note)) {
                if (e.isShiftDown()) {
                    selectedNotes.remove(src.note);
                    return;
                }
            } else {
                if (e.isShiftDown()) {
                    selectedNotes.add(src.note);
                } else {
                    selectedNotes.clear();
                    selectedNotes.add(src.note);
                }
            }

            startValue = src.field.getValue();
            var fieldDef = src.field.getFieldDef();

            originalValues = new double[selectedNotes.size()];
            affectedFields = new Field[selectedNotes.size()];

            for (int i = 0; i < selectedNotes.size(); i++) {
                var n = selectedNotes.get(i);
                // If this throws an exception, let it get reported higher up
                var field = n.getField(fieldDef).get();
                affectedFields[i] = field;
                originalValues[i] = field.getValue();
            }
        }
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        if (originalValues == null || currentPin == null) {
            return;
        }

        Pin src = currentPin;
        var pt = e.getPoint();

        var mouseVal = yScale.calcReverse(pt.getY());
        var valDiff = mouseVal - startValue;

        for (int i = 0; i < selectedNotes.size(); i++) {
            affectedFields[i].setValue(originalValues[i] + valDiff);
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) {

        if (originalValues != null) {
            var endValues = new double[originalValues.length];
            for (int i = 0; i < affectedFields.length; i++) {
                endValues[i] = affectedFields[i].getValue();
            }
            undoManager.addEdit(new FieldsEdit(affectedFields, originalValues, endValues));
        }

        affectedFields = null;
        startValue = 0.0;
        originalValues = null;
        currentPin = null;
    }

    protected void showPopup(Component comp, MouseEvent e) {
        JPopupMenu menu = new JPopupMenu();

        menu.add(new AbstractAction("Set selected field values to default") {
            @Override
            public void actionPerformed(ActionEvent e) {
                var fieldDef = selectedFieldDef.get();

                if (fieldDef != null) {
                    var size = selectedNotes.size();
                    double[] originalValues = new double[size];
                    double[] endValues = new double[size];
                    Field[] affectedFields = new Field[size];

                    for (int i = 0; i < selectedNotes.size(); i++) {
                        var note = selectedNotes.get(i);

                        var fld = note.getField(fieldDef).get();
                        originalValues[i] = fld.getValue();
                        endValues[i] = fieldDef.getDefaultValue();
                        affectedFields[i] = fld;
                        
                        fld.setValue(endValues[i]);
                    }
                    undoManager.addEdit(new FieldsEdit(affectedFields, originalValues, endValues));
                }
            }

            @Override
            public boolean isEnabled() {
                return selectedNotes.size() > 0;
            }
            
            

        });

        menu.add(new AbstractAction("Set all field values to default") {
            @Override
            public void actionPerformed(ActionEvent e) {
                var fieldDef = selectedFieldDef.get();
                var p = currentPianoRoll.get();
                if (fieldDef != null && p != null) {
                    
                    var notes = p.getNotes();
                    var size = notes.size();
                    double[] originalValues = new double[size];
                    double[] endValues = new double[size];
                    Field[] affectedFields = new Field[size];

                    for (int i = 0; i < notes.size(); i++) {
                        var note = notes.get(i);

                        var fld = note.getField(fieldDef).get();
                        originalValues[i] = fld.getValue();
                        endValues[i] = fieldDef.getDefaultValue();
                        affectedFields[i] = fld;
                        
                        fld.setValue(endValues[i]);
                    }
                    undoManager.addEdit(new FieldsEdit(affectedFields, originalValues, endValues));
                }
            }

        });

        menu.show(comp, e.getX(), e.getY());
    }

}
