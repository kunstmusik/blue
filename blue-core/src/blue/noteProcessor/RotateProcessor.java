package blue.noteProcessor;

import blue.BlueSystem;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.util.Collections;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class RotateProcessor implements NoteProcessor, java.io.Serializable {

    int noteIndex = 1;

    public RotateProcessor() {
    }

    public String toString() {
        // return "[sublist] start: " + start + " end: " + end;
        return "[rotate]";
    }

    public String getNoteIndex() {
        return Integer.toString(noteIndex);
    }

    public void setNoteIndex(String noteIndex) {
        this.noteIndex = Integer.parseInt(noteIndex);
    }

    public final void processNotes(NoteList in) throws NoteProcessorException {
        if (in.size() < 2 || noteIndex == 1) {
            return;
        }

        in.sort();

        Note lastNote = in.getNote(in.size() - 1);

        float startTime = lastNote.getStartTime()
                + lastNote.getSubjectiveDuration();

        int index = noteIndex;
        if (index > 0) {
            index = index - 1;
        } else {
            index = in.size() + index;
        }

        if (index > in.size()) {
            throw new NoteProcessorException(this, BlueSystem
                    .getString("noteProcessorException.rotateIndex"));
        }
        Collections.rotate(in, -index);

        index = in.size() - index;

        while (index < in.size()) {
            Note n = in.getNote(index);
            n.setStartTime(n.getStartTime() + startTime);
            index++;
        }

        ScoreUtilities.normalizeNoteList(in);

    }

    public static void main(String args[]) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.addNote(Note.createNote("i1 " + (i * 2) + " 5 " + i + " 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        RotateProcessor rlp = new RotateProcessor();
        rlp.setNoteIndex("-3");
        try {
            rlp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        RotateProcessor rlp = new RotateProcessor();

        rlp.setNoteIndex(data.getElement("noteIndex").getTextString());

        return rlp;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        retVal.addElement("noteIndex").setText(this.getNoteIndex());

        return retVal;
    }
}