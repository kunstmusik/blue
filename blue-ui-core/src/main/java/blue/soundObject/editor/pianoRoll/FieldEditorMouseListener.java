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

import blue.soundObject.editor.pianoRoll.Pin;
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.PianoNote;
import blue.utilities.scales.ScaleLinear;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javafx.collections.ObservableList;
import javax.swing.SwingUtilities;

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
    
    public FieldEditorMouseListener(ObservableList<PianoNote> selectedNotes, ScaleLinear yScale) {
        this.selectedNotes = selectedNotes;
        this.yScale = yScale;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        Pin src = (Pin) e.getComponent();
        
        if(selectedNotes.contains(src.note)) {
            if(e.isShiftDown()) {
                selectedNotes.remove(src.note);
                return;
            }
        } else {
            if(e.isShiftDown()) {
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
        
        for(int i = 0; i < selectedNotes.size(); i++) {
            var n = selectedNotes.get(i);
            // If this throws an exception, let it get reported higher up
            var field = n.getField(fieldDef).get();
            affectedFields[i] = field;
            originalValues[i] = field.getValue();
        }
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        if(originalValues == null) {
            return;
        }
        
        Pin src = (Pin) e.getComponent();
        var pt = SwingUtilities.convertPoint(src, e.getPoint(), src.getParent());
        
        var mouseVal = yScale.calcReverse(pt.getY());
        var valDiff = mouseVal - startValue;
        
        for(int i = 0; i < selectedNotes.size(); i++) {           
            affectedFields[i].setValue(originalValues[i] + valDiff);
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        affectedFields = null;
        startValue = 0.0;
        originalValues = null;
    }

}
