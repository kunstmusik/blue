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
package blue.utility.midi;

import blue.utility.*;
import java.io.File;
import java.io.IOException;

import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;

import blue.SoundLayer;
import blue.soundObject.GenericScore;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObjectException;
import blue.utilities.MidiUtilities;
import java.awt.Frame;

public class MidiImportUtilities {

    private static final String NOTE_TEMPLATE = "i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>";

    /**
     * Converts a MIDI file to a blue polyObject. Will return null if unable to
     * open or process the file.
     *
     * @param midiFile
     * @return
     * @throws NoteParseException
     */
    public static PolyObject convertMidiFile(Frame root, File midiFile)
            throws NoteParseException {
        if (midiFile == null || !midiFile.exists()) {
            return null;
        }

        Sequence sequence = null;

        try {
            sequence = MidiSystem.getSequence(midiFile);
        } catch (InvalidMidiDataException imde) {
            imde.printStackTrace();
        } catch (IOException ioe) {
            ioe.printStackTrace();
        }

        if (sequence == null) {
            return null;
        }

        PolyObject pObj = new PolyObject();

        Track[] tracks = sequence.getTracks();

        float divType = sequence.getDivisionType();

        if (divType == Sequence.PPQ) {
            divType = 1.0f;
        }

        float ticksLength = (float) sequence.getResolution();

        MidiImportSettings settings = getMidiImportSettings(tracks);

        if (settings.getRowCount() == 0) {
            return null;
        }

        boolean retVal = MidiImportSettingsDialog.ask(root, settings);

        if (!retVal) {
            return null;
        }

        for (int i = 0; i < tracks.length; i++) {
            TrackImportSettings trSettings = settings
                    .getTrackSettingsForTrackNum(i);

            if (trSettings == null) {
                continue;
            }

            Track track = tracks[i];

            NoteList nl = getNoteListForTrack(track, divType, ticksLength,
                    trSettings.getNoteTemplate(), trSettings.getInstrId());

            if (nl == null || nl.size() == 0) {
                continue;
            }

            GenericScore genSco = new GenericScore();

            if (trSettings.isTrim()) {
                // Assumes NoteList is already sorted
                float start = nl.getNote(0).getStartTime();
                genSco.setStartTime(start);
                ScoreUtilities.normalizeNoteList(nl);
            } else {
                genSco.setStartTime(0.0f);
            }

            genSco.setSubjectiveDuration(ScoreUtilities.getTotalDuration(nl));
            genSco.setText(nl.toString());

            genSco.setName("Track " + i);

            SoundLayer sLayer = (SoundLayer)pObj.newLayerAt(-1);
            sLayer.addSoundObject(genSco);
        }

        return pObj;
    }

    private static NoteList getNoteListForTrack(Track track, float divType,
            float ticksLength, String template, String instrId)
            throws NoteParseException {
        if (track.size() == 0) {
            return null;
        }

        MNote[] notes = new MNote[128];

        for (int j = 0; j < notes.length; j++) {
            notes[j] = new MNote();
        }

        NoteList nl = new NoteList();

        for (int j = 0; j < track.size(); j++) {
            MidiEvent me = track.get(j);
            MidiMessage message = me.getMessage();

            if (message instanceof ShortMessage) {

                ShortMessage shortMsg = (ShortMessage) message;
                int noteNum, velocity;
                MNote n;

                float time = (me.getTick() / ticksLength) * divType;

                switch (shortMsg.getCommand()) {
                    case ShortMessage.NOTE_ON:

                        noteNum = shortMsg.getData1();
                        velocity = shortMsg.getData2();

                        n = notes[noteNum];

                        if (velocity > 0) {
                            n.start = time;
                            n.velocity = velocity;
                        } else {
                            float start = n.start;
                            float duration = time - n.start;

                            String note = MidiUtilities.processNoteTemplate(
                                    template, instrId, start, duration,
                                    noteNum, velocity);

                            nl.addNote(Note.createNote(note));

                            n.clear();
                        }

                        break;
                    case ShortMessage.NOTE_OFF:
                        noteNum = shortMsg.getData1();
                        velocity = shortMsg.getData2();

                        n = notes[noteNum];

                        float start = n.start;
                        float duration = time - n.start;

                        String note = MidiUtilities.processNoteTemplate(
                                template, instrId, start, duration, noteNum,
                                velocity);

                        nl.addNote(Note.createNote(note));

                        n.clear();

                        break;
                }

            }

        }

        return nl;
    }


    private static MidiImportSettings getMidiImportSettings(Track[] tracks) {
        MidiImportSettings settings = new MidiImportSettings();

        for (int i = 0; i < tracks.length; i++) {

            Track track = tracks[i];

            boolean containsNotes = false;

            for (int j = 0; j < track.size(); j++) {
                MidiEvent me = track.get(j);
                MidiMessage message = me.getMessage();

                if (message instanceof ShortMessage) {

                    ShortMessage shortMsg = (ShortMessage) message;
                    int velocity;
                    MNote n;

                    switch (shortMsg.getCommand()) {
                        case ShortMessage.NOTE_ON:

                            velocity = shortMsg.getData2();

                            if (velocity == 0) {
                                containsNotes = true;
                            }
                            break;
                        case ShortMessage.NOTE_OFF:
                            containsNotes = true;
                            break;
                    }

                    if (containsNotes) {
                        break;
                    }

                }
            }

            if (containsNotes) {
                TrackImportSettings trSettings = new TrackImportSettings();
                String instrId = Integer.toString(i);

                trSettings.setInstrId(instrId);
                trSettings.setTrackNumber(i);
                trSettings.setNoteTemplate(NOTE_TEMPLATE);

                settings.addTrackImportSetting(trSettings);
            }
        }
        return settings;
    }

    public static double cpsmid(int midi) {
        return 440.0 * Math.exp(Math.log(2.0) * ((midi - 69) / 12.0));
    }

    public static void main(String args[]) {
        try {
            PolyObject pObj = MidiImportUtilities.convertMidiFile(null, new File(
                    "/home/steven/Desktop/DukasVillanelle.mid"));
            System.out.println(pObj.generateNotes(0.0f, -1.0f));
        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (SoundObjectException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
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
