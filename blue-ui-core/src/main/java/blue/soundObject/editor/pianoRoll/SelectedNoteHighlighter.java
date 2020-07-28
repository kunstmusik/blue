/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
import java.awt.Color;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import javax.swing.BorderFactory;
import javax.swing.JPanel;

public class SelectedNoteHighlighter extends JPanel implements PropertyChangeListener {

    private PianoRoll pianoRoll;
    private PianoNote note;

    private static final Set<String> NOTE_PROPS = new HashSet<>(Arrays.asList("octave", "scaleDegree"));

    SelectedNoteHighlighter(PianoRoll pianoRoll, PianoNote note) {

        this.pianoRoll = pianoRoll;
        this.note = note;

        this.setBackground(Color.GREEN);
        this.setSize(5, pianoRoll.getNoteHeight());
        this.setBorder(BorderFactory.createRaisedBevelBorder());

    }

    @Override
    public void removeNotify() {
        pianoRoll.removePropertyChangeListener(this);
        note.removePropertyChangeListener(this);

        super.removeNotify();
    }

    @Override
    public void addNotify() {
        super.addNotify();

        updateLocation();

        pianoRoll.addPropertyChangeListener(this);
        note.addPropertyChangeListener(this);
    }

    protected void updateLocation() {
        var noteHeight = pianoRoll.getNoteHeight();
        var numScaleDegrees = pianoRoll.getScale().getNumScaleDegrees();

        var max = 16 * numScaleDegrees - 1;
        var noteNum = note.getOctave() * numScaleDegrees + note.getScaleDegree();

        var newY = (max - noteNum) * noteHeight;

        if (newY != getY()) {
            setLocation(getX(), newY);
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == pianoRoll && "noteHeight".equals(evt.getPropertyName())) {
            this.setSize(5, pianoRoll.getNoteHeight());
            updateLocation();
        } else if (evt.getSource() == note && NOTE_PROPS.contains(evt.getPropertyName())) {
            updateLocation();
        }
    }

}
