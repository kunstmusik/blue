package blue.soundObject.notation;

import blue.soundObject.Note;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 * 
 * internally uses midi note numbers, can output to either midi, cps, pch, oct
 * notation
 * 
 */

public class NotationNote {
    public static final int MIDI = 0;

    public static final int CPS = 1;

    public static final int PCH = 2;

    public static final int OCT = 3;

    public static final int SIXTY_FOURTH = 1;

    public static final int THIRTY_SECOND = 2;

    public static final int SIXTEENTH = 3;

    public static final int EIGHTH = 4;

    public static final int QUARTER = 5;

    public static final int HALF = 6;

    public static final int WHOLE = 7;

    private boolean isRest = false;

    private int accidental = 0; // number of either flats or sharps to add

    private int dots = 0; // number of dots to add

    int midiPitch = 60;

    int noteDuration = 5;

    public NotationNote() {
    }

    public NotationNote(NotationNote note) {
        isRest = note.isRest;
        accidental = note.accidental;
        dots = note.dots;
        midiPitch = note.midiPitch;
        noteDuration = note.noteDuration;
    }

    public int getMidiPitch() {
        return this.midiPitch;
    }

    public void setMidiPitch(int midiPitch) {
        this.midiPitch = midiPitch;
    }

    public int getNoteDuration() {
        return this.noteDuration;
    }

    public void setNoteDuration(int noteDuration) {
        if (noteDuration < 1 || noteDuration > 7) {
            System.err
                    .println("[blue.soundObject.notation.NotationNote :: setNoteDuration()] - Error - invalid note duration : "
                            + noteDuration);
            return;
        }
        this.noteDuration = noteDuration;
    }

    public void increaseDots() {
        this.dots++;
    }

    public void decreaseDots() {
        if (this.dots > 0) {
            this.dots--;
        }
    }

    public void increaseAccidentals() {
        this.accidental++;
    }

    public void decreaseAccidentals() {
        if (this.accidental > 0) {
            this.accidental--;
        }
    }

    public Note generateNote(String noteTemplate, int outputType) {
        return null;
    }
}