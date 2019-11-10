package blue.noteProcessor;

import blue.BlueSystem;
import blue.plugin.NoteProcessorPlugin;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

@NoteProcessorPlugin(displayName="SubListProcessor", position = 60)
public class SubListProcessor implements NoteProcessor {

    int start = 1;

    int end = 2;

    public SubListProcessor() {
    }
    public SubListProcessor(SubListProcessor slp) {
        start = slp.start;
        end = slp.end;
    }

    @Override
    public String toString() {
        // return "[sublist] start: " + start + " end: " + end;
        return "[sublist]";
    }

    public String getStart() {
        return Integer.toString(start);
    }

    public void setStart(String start) {
        this.start = Integer.parseInt(start);
    }

    public String getEnd() {
        return Integer.toString(end);
    }

    public void setEnd(String end) {
        this.end = Integer.parseInt(end);
    }

    @Override
    public final void processNotes(NoteList in) throws NoteProcessorException {
        NoteList tempList = new NoteList();

        if (end < 1) {
            throw new NoteProcessorException(this, BlueSystem
                    .getString("noteProcessorException.noteListEnd"));
        }
        for (int i = 0; i < in.size(); i++) {
            if (i >= (start - 1) && i <= (end - 1)) {
                tempList.add(in.get(i));
            }
        }
        in.clear();
        in.merge(tempList);

        blue.utility.ScoreUtilities.normalizeNoteList(in);

    }

    public static void main(String[] args) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.add(Note.createNote("i1 " + (i * 2) + " 2 " + i + " 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        SubListProcessor slp = new SubListProcessor();
        slp.setStart("2");
        slp.setEnd("5");
        try {
            slp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        SubListProcessor slp = new SubListProcessor();

        slp.setStart(data.getElement("start").getTextString());
        slp.setEnd(data.getElement("end").getTextString());

        return slp;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        retVal.addElement("start").setText(this.getStart());
        retVal.addElement("end").setText(this.getEnd());

        return retVal;
    }

    @Override
    public SubListProcessor deepCopy() {
        return new SubListProcessor(this);
    }
}
