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
package blue.utilities;

public class MidiUtilities {

    private static final String NOTE_TEMPLATE = "i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>";

    public static String processNoteTemplate(final String noteTemplate,
            final String instrId, final float start, final float duration,
            final int key, final int velocity) {
        String note = noteTemplate;

        // Pitch Values
        String midiKey = Integer.toString(key);

        int scaleDegree = (key % 12);
        String scaleDegreeStr = (scaleDegree < 10) ? "0" + scaleDegree
                : Integer.toString(scaleDegree);

        String midiPch = ((key / 12) + 3) + "." + scaleDegreeStr;
        String midiOct = Float.toString((key / 12.0f) + 3);
        String midiCps = Double.toString(cpsmid(key));

        // Velocity Values
        String midiVel = Integer.toString(velocity);
        float velf = (float) velocity;
        String midiVelAmp = Float.toString((velf * velf / 16239.0f) * 32768.0f);

        // do replacement
        note = TextUtilities.replaceAll(note, "<INSTR_ID>", instrId);
        note = TextUtilities.replaceAll(note, "<START>", Float.toString(start));
        note = TextUtilities
                .replaceAll(note, "<DUR>", Float.toString(duration));
        note = TextUtilities.replaceAll(note, "<KEY>", midiKey);
        note = TextUtilities.replaceAll(note, "<KEY_PCH>", midiPch);
        note = TextUtilities.replaceAll(note, "<KEY_OCT>", midiOct);
        note = TextUtilities.replaceAll(note, "<KEY_CPS>", midiCps);
        note = TextUtilities.replaceAll(note, "<VELOCITY>", midiVel);
        note = TextUtilities.replaceAll(note, "<VELOCITY_AMP>", midiVelAmp);

        return note;
    }

   
    public static double cpsmid(int midi) {
        return 440.0 * Math.exp(Math.log(2.0) * ((midi - 69) / 12.0));
    }

    private static class MNote {
        public int velocity = -1;

        public float start = -1.0f;

        public void clear() {
            velocity = -1;
            start = -1.0f;
        }
    }
}
