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
import blue.soundObject.pianoRoll.FieldDef;
import blue.utilities.scales.ScaleLinear;
import java.awt.Color;
import java.awt.Graphics;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class FieldEditor extends JPanel {

    private PianoRoll p = null;

    FieldDef selectedField = null;

    public FieldEditor() {
        setBackground(Color.BLACK);
    }

    public void editPianoRoll(PianoRoll p) {
//        if (this.p != null && this.p != p) {
//            this.p.removePropertyChangeListener(this);
//        }
//
//        if (this.p != p) {
//            p.addPropertyChangeListener(this);
//        }

        this.p = p;

        var fieldDefinitions = p.getFieldDefinitions();
        selectedField = (fieldDefinitions.isEmpty()) ? null : fieldDefinitions.get(0);

        this.removeAll();

//        for (PianoNote note : p.getNotes()) {
//            addNoteView(note);
//        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g); //To change body of generated methods, choose Tools | Templates.

        if (selectedField == null) {
            return;
        }

        var pixelSecond = p.getPixelSecond();

        var bottom = getHeight() - 5;
        var top = 5;

        ScaleLinear sl = new ScaleLinear(selectedField.getMinValue(), selectedField.getMaxValue(), bottom, top);

        g.setColor(Color.WHITE);
        for (var note : p.getNotes()) {
            var x = (int) (pixelSecond * note.getStart());

            var field = note.getFields().stream()
                    .filter(f -> f.getFieldDef() == selectedField)
                    .findFirst();

            if (field.isPresent()) {
                var y = sl.calc(field.get().getValue());
                g.drawLine(x, bottom, x, (int) y);
            }
        }
    }

}
