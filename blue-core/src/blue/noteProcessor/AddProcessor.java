package blue.noteProcessor;

import blue.BlueSystem;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;
import java.io.Serializable;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class AddProcessor implements NoteProcessor, Serializable {
    float value = 0.0f;

    int pfield = 4;

    public AddProcessor() {
    }

    public String toString() {
        // return "[add] pfield: " + pfield + " value: " + value;
        return "[add]";
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        this.pfield = Integer.parseInt(pfield);
    }

    public String getVal() {
        return Float.toString(value);
    }

    public void setVal(String value) {
        this.value = Float.parseFloat(value);
    }

    public final void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;
        float fieldVal = 0f;
        for (int i = 0; i < in.size(); i++) {
            temp = in.getNote(i);
            try {
                fieldVal = Float.parseFloat(temp.getPField(pfield));
            } catch (NumberFormatException ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.pfieldNotFloat"),
                        pfield);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }
            temp.setPField(Float.toString(fieldVal + value), pfield);
        }
    }

    public static void main(String args[]) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.addNote(Note.createNote("i1 " + (i * 2) + " 2 3 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        AddProcessor ap = new AddProcessor();
        ap.setPfield("2");
        ap.setVal("-2.2");
        try {
            ap.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        AddProcessor ap = new AddProcessor();

        ap.setPfield(data.getElement("pfield").getTextString());
        ap.setVal(data.getElement("value").getTextString());

        return ap;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        retVal.addElement("pfield").setText(this.getPfield());
        retVal.addElement("value").setText(this.getVal());

        return retVal;
    }
}
