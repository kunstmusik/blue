package blue.noteProcessor;

import blue.BlueSystem;
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

public class EqualsProcessor implements NoteProcessor, java.io.Serializable {

    String value = "2.0";

    int pfield = 4;

    public EqualsProcessor() {
    }

    @Override
    public String toString() {
        // return "[add] pfield: " + pfield + " value: " + value;
        return "[equals]";
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        this.pfield = Integer.parseInt(pfield);
    }

    public String getVal() {
        return value;
    }

    public void setVal(String value) {
        // does it make any sense to set pField 2?
        /*
         * if(this.pfield == 3) { return; }
         */

        this.value = value;
    }

    public final void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;

        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);
            try {
                if (this.pfield == 3) {
                    // set the subjectiveDuration to the value
                    // as that is what is used in the Note class
                    // for generating the note's p3
                    temp.setSubjectiveDuration(Float.parseFloat(this.value));
                } else {
                    temp.setPField(this.value, this.pfield);
                }
            } catch (NumberFormatException ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.pfieldNotFloat"),
                        pfield);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }
        }
    }

    public static void main(String args[]) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.add(Note.createNote("i1 " + (i * 2) + " 2 3 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        EqualsProcessor ep = new EqualsProcessor();
        ep.setPfield("4");
        ep.setVal("17");
        try {
            ep.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Error: " + ex.getMessage());
        }

        System.out.println("a after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        EqualsProcessor ep = new EqualsProcessor();

        ep.setPfield(data.getElement("pfield").getTextString());
        ep.setVal(data.getElement("value").getTextString());

        return ep;
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
