package blue.soundObject.notation;

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
 */

public class NotationEditPoint {
    int index = 0;

    int midiPch = 60;

    public NotationEditPoint() {
    }

    public int getIndex() {
        return index;
    }

    public int getMidiPch() {
        return midiPch;
    }

    public void setMidiPch(int midiPch) {
        this.midiPch = midiPch;
    }

    public void setIndex(int index) {
        this.index = index;
    }

}