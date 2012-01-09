package blue.soundObject.notation;

import blue.soundObject.NoteList;
import java.util.ArrayList;

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

public class NotationStaff extends ArrayList {
    public static final int TREBLE = 0;

    public static final int BASS = 1;

    private int clef = TREBLE;

    private String noteTemplate = ""; // requires $pch

    private String staffName = "new staff";

    public NotationStaff() {

    }

    public void setClef(int clefType) {
        if (clefType > 1 || clefType < 0) {
            System.err
                    .println("[blue.soundObject.notation.NotationStaff :: setClef()] - Unsupported clef type - "
                            + clefType);
            return;
        }
        this.clef = clefType;
    }

    public int getClef() {
        return this.clef;
    }

    public void addNotationNote(NotationNote note) {
        this.add(note);
    }

    public NotationNote getNotationNote(int index) {
        return (NotationNote) this.get(index);
    }

    public String getStaffName() {
        return this.staffName;
    }

    public void setStaffName(String staffName) {
        this.staffName = staffName;
    }

    public NoteList generateNotes() {
        return null;
    }
}