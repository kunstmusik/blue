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
import blue.soundObject.pianoRoll.PianoNote;
import blue.soundObject.pianoRoll.Scale;
import java.awt.Color;
import java.awt.event.HierarchyEvent;
import java.awt.event.HierarchyListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.border.BevelBorder;
import javax.swing.border.Border;

/**
 * @author steven
 * 
 */

public class PianoNoteView extends JPanel implements PropertyChangeListener,
        Comparable<PianoNoteView> {
    private static final int OCTAVES = 16;

    // private static Border NORMAL_BORDER = new LineBorder(Color.LIGHT_GRAY);
    private static Border NORMAL_BORDER = BorderFactory
            .createBevelBorder(BevelBorder.RAISED);

    private static Color NORMAL_COLOR = Color.GRAY;

    private static Color SELECTED_COLOR = Color.WHITE;

    private PianoNote note;

    private PianoRoll p;

    public PianoNoteView(PianoNote note, PianoRoll p) {
        this.note = note;
        this.p = p;

        this.setBackground(NORMAL_COLOR);
        this.setBorder(NORMAL_BORDER);

        this.setOpaque(true);

        updatePropertiesFromNote();

        note.addPropertyChangeListener(this);

        this.addHierarchyListener((HierarchyEvent e) -> {
            if (getParent() == null) {
                removeAsListener();
            }
        });

    }

    public void removeAsListener() {
        note.removePropertyChangeListener(this);
    }

    public PianoNote getPianoNote() {
        return this.note;
    }

    public void updateNoteStartFromLocation() {
        int pixelSecond = p.getPixelSecond();
        
        float start = this.getX() / (float) pixelSecond;

        updateNotePitchFromY();
        this.note.setStart(start);

    }

    public void updateNotePitchFromY() {
        int scaleDegrees;
        int total;
        int yVal;
        if (p.getPchGenerationMethod() == PianoRoll.GENERATE_MIDI) {
            scaleDegrees = 12;

            total = 128 * p.getNoteHeight();
            yVal = total - this.getY();
        } else {
            scaleDegrees = p.getScale().getNumScaleDegrees();

            total = scaleDegrees * p.getNoteHeight() * OCTAVES;
            yVal = total - this.getY();
        }
        int layerIndex = (yVal / p.getNoteHeight()) - 1;
        int oct = layerIndex / scaleDegrees;
        int pch = layerIndex % scaleDegrees;
        this.note.setOctave(oct);
        this.note.setScaleDegree(pch);
    }

    private void updatePropertiesFromNote() {
        int pixelSecond = p.getPixelSecond();

        int x = (int) (note.getStart() * pixelSecond);

        int y;

        if (p.getPchGenerationMethod() == PianoRoll.GENERATE_MIDI) {
            y = getMIDIY(note.getOctave(), note.getScaleDegree());
        } else {
            y = getScaleY(p.getScale(), note.getOctave(), note.getScaleDegree());
        }

        int w = (int) (note.getDuration() * pixelSecond);

        this.setLocation(x, y);
        this.setSize(w, p.getNoteHeight());
    }

    private int getMIDIY(int octave, int scaleDegree) {
        int scaleDegrees = 12;

        int noteHeight = p.getNoteHeight();
        int totalHeight = noteHeight * 128;

        int yVal = ((octave * scaleDegrees) + scaleDegree + 1) * noteHeight;

        return (totalHeight - yVal);
    }

    private int getScaleY(Scale scale, int octave, int scaleDegree) {
        int scaleDegrees = scale.getNumScaleDegrees();

        int noteHeight = p.getNoteHeight();
        int totalHeight = noteHeight * scaleDegrees * OCTAVES;

        int yVal = ((octave * scaleDegrees) + scaleDegree + 1) * noteHeight;

        return (totalHeight - yVal);
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyChangeListener#propertyChange(java.beans.PropertyChangeEvent)
     */
    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == note) {
            updatePropertiesFromNote();
        }
    }

    /**
     * 
     */
    public void setSelected(boolean selected) {
        if (selected) {
            setBackground(SELECTED_COLOR);
        } else {
            setBackground(NORMAL_COLOR);
        }
    }

    /**
     * 
     */
    public void updateNoteDurFromWidth() {
        int pixelSecond = p.getPixelSecond();
        this.note.setDuration((float) this.getWidth() / pixelSecond);
    }

    @Override
    public int compareTo(PianoNoteView a) {
        int x1 = this.getX();
        int x2 = a.getX();

        if (x1 > x2) {
            return 1;
        } else if (x1 < x2) {
            return -1;
        }
        return 0;
    }
}