package blue.noteProcessor;

import blue.BlueSystem;
import blue.plugin.NoteProcessorPlugin;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;

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

@NoteProcessorPlugin(displayName="SwitchProcessor", position = 120)
public class SwitchProcessor implements NoteProcessor, java.io.Serializable {

    int pfield1 = 4;

    int pfield2 = 5;

    @Override
    public String toString() {
        return "[switch]";
    }

    public String getPfield1() {
        return Integer.toString(pfield1);
    }

    public void setPfield1(String pfield1) {
        this.pfield1 = Integer.parseInt(pfield1);
    }

    public String getPfield2() {
        return Integer.toString(pfield2);
    }

    public void setPfield2(String pfield2) {
        this.pfield2 = Integer.parseInt(pfield2);
    }

    public final void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;
        String tempPField;
        int pcount = 0;
        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);

            // validate necessary pfields are there
            pcount = temp.getPCount();
            if (pfield1 < 1 || pfield1 >= pcount) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield1);
            }
            if (pfield2 < 1 || pfield2 >= pcount) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield2);
            }

            tempPField = temp.getPField(pfield1);
            temp.setPField(temp.getPField(pfield2), pfield1);
            temp.setPField(tempPField, pfield2);
        }
    }

    public static void main(String[] args) {
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

        SwitchProcessor sp = new SwitchProcessor();
        sp.setPfield1("5");
        sp.setPfield2("4");
        try {
            sp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        SwitchProcessor ap = new SwitchProcessor();

        ap.setPfield1(data.getElement("pfield1").getTextString());
        ap.setPfield2(data.getElement("pfield2").getTextString());

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

        retVal.addElement("pfield1").setText(this.getPfield1());
        retVal.addElement("pfield2").setText(this.getPfield2());

        return retVal;
    }
}