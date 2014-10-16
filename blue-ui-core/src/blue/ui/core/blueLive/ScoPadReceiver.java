/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.blueLive;

import blue.utilities.MidiUtilities;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.Receiver;
import javax.sound.midi.ShortMessage;

/**
 * Keeps track of what MIDI notes are on and off, will add or subtract notes to
 * text area
 * 
 * @author steven
 */
public class ScoPadReceiver implements Receiver {

    MidiNote[] notes;

    /** Creates a new instance of MidiScoInputManager */
    public ScoPadReceiver() {
        notes = new MidiNote[128];
        for (int i = 0; i < notes.length; i++) {
            notes[i] = new MidiNote();
        }
    }

    public String getNotes(String noteTemplate, String instrId, float start,
            float duration) {
        StringBuffer buffer = new StringBuffer();

        for (int i = 0; i < notes.length; i++) {

            if (notes[i].velocity < 0) {
                continue;
            }

            String note = MidiUtilities.processNoteTemplate(noteTemplate,
                    instrId, start, duration, i, notes[i].velocity);

            buffer.append(note).append("\n");
        }

        return buffer.toString();
    }

    /* MIDI Receiver Methods */

    public void send(MidiMessage message, long timeStamp) {

        if (message instanceof ShortMessage) {

            ShortMessage shortMsg = (ShortMessage) message;
            int noteNum, velocity;
            // long duration;
            MidiNote n;

            switch (shortMsg.getCommand()) {
                case ShortMessage.NOTE_ON:

                    noteNum = shortMsg.getData1();
                    velocity = shortMsg.getData2();

                    n = notes[noteNum];

                    if (velocity > 0) {
                        n.start = System.currentTimeMillis();
                        n.velocity = velocity;
                    } else {
                        // duration = System.currentTimeMillis() - n.start;

                        // if(start > 0) {
                        //
                        // String noteStr = "i1 " + ((n.start - start)/ 1000.0f)
                        // + " " + (duration / 1000.f) + " " + noteNum + " " +
                        // n.velocity;
                        // outputTextArea.setText(outputTextArea.getText() +
                        // noteStr + "\n");
                        //
                        // }

                        n.start = -1;
                        n.velocity = -1;
                    }

                    // System.err.println(noteNum + ":" + velocity);

                    break;
                case ShortMessage.NOTE_OFF:
                    noteNum = shortMsg.getData1();
                    velocity = shortMsg.getData2();

                    n = notes[noteNum];

                    // duration = System.currentTimeMillis() - n.start;

                    // if(start > 0) {
                    // String noteStr = "i1 " + ((n.start - start) / 1000.0f) +
                    // " " + (duration / 1000.f) + " " + noteNum + " " +
                    // n.velocity;
                    // outputTextArea.setText(outputTextArea.getText() + noteStr
                    // + "\n");
                    //
                    // }

                    n.start = -1;
                    n.velocity = -1;

                    break;
            }
        }
    }

    public void close() {
        for (int i = 0; i < 128; i++) {
            notes[i].start = -1;
            notes[i].velocity = -1;
        }
    }

    class MidiNote {
        long start = -1;
        int velocity = -1;
    }
}
