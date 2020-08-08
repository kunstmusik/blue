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
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.PianoNote;
import blue.utilities.scales.ScaleLinear;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.beans.PropertyChangeListener;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
class Pin extends JPanel {

    private static final Color NORMAL_COLOR = Color.GRAY;

    private static final Color SELECTED_COLOR = Color.WHITE;

    public final Field field;
    public final PianoNote note;
    private final PianoRoll pianoRoll;
    private final ScaleLinear yScale;
    private final ObservableList<PianoNote> selectedNotes;

    private Color drawColor;

    private final javax.swing.event.ChangeListener cl = src -> updateLocation();

    private final PropertyChangeListener pcl = pce -> {
        if ("start".equals(pce.getPropertyName())) {
            updateLocation();
        }
    };

    private final ChangeListener<? super Number> valueListener = (obs, old, newVal) -> updateLocation();

    ListChangeListener<PianoNote> lcl;

    public Pin(PianoRoll p, ScaleLinear yScale, PianoNote n, Field field,
            ObservableList<PianoNote> selectedNotes) {
        this.pianoRoll = p;
        this.yScale = yScale;
        this.note = n;
        this.field = field;
        this.selectedNotes = selectedNotes;

        lcl = (change) -> {
            var selected = selectedNotes.contains(note);
            drawColor = selected ? SELECTED_COLOR : NORMAL_COLOR;
        };

        var selected = selectedNotes.contains(note);
        drawColor = selected ? SELECTED_COLOR : NORMAL_COLOR;

        setSize(5,5);
        setOpaque(false);
        setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
    } 

    @Override
    public void addNotify() {
        super.addNotify();
        field.valueProperty().addListener(valueListener);
        updateLocation();
        yScale.addChangeListener(cl);
        note.addPropertyChangeListener(pcl);
        selectedNotes.addListener(lcl);
    }

    @Override
    public void removeNotify() {
        yScale.removeChangeListener(cl);
        note.removePropertyChangeListener(pcl);
        field.valueProperty().removeListener(valueListener);
        selectedNotes.removeListener(lcl);
        super.removeNotify();
    }

    private void updateLocation() {
        int x = (int) (note.getStart() * pianoRoll.getPixelSecond());
        int y = (int) yScale.calc(field.getValue());
        setLocation(x - 2, y - 2);
    }

    @Override
    protected void paintComponent(Graphics g) {
        java.awt.Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setStroke(new BasicStroke(2));
        final int width = getWidth() - 1;
        final int height = getHeight() - 1;

        if (drawColor == SELECTED_COLOR) {
            g2d.setColor(drawColor);
            g.fillOval(0, 0, width, height);
            g2d.drawOval(0, 0, width, height);            
        } else {
            g2d.setColor(Color.BLACK);
            g.fillOval(0, 0, width, height);
            g2d.setColor(drawColor);
            g2d.drawOval(0, 0, width, height);
        }

    }

}
