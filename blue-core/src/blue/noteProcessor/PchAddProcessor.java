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
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author steven yi
 * @version 1.0
 */

@NoteProcessorPlugin(displayName="PchAddProcessor", position = 20)
public class PchAddProcessor implements NoteProcessor {

    int value = 0;

    int pfield = 4;

    public PchAddProcessor() {
    }
    public PchAddProcessor(PchAddProcessor pap) {
        value = pap.value;
        pfield = pap.pfield;
    }

    @Override
    public String toString() {
        // return "[add] pfield: " + pfield + " value: " + value;
        return "[pch add]";
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        int p = Integer.parseInt(pfield);
        if (p > 3) {
            this.pfield = p;
        }
    }

    public String getVal() {
        return Integer.toString(value);
    }

    public void setVal(String value) {
        this.value = Integer.parseInt(value);
    }

    @Override
    public final void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;
        String val;
        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);

            try {
                val = temp.getPField(pfield).trim();
                Double.parseDouble(val);
            } catch (NumberFormatException ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.pfieldNotDouble"),
                        pfield);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }

            double baseTen = blue.utility.ScoreUtilities.getBaseTen(val);

            baseTen += value;

            int octave = (int) (baseTen / 12);
            double strPch = (baseTen % 12) / 100;

            temp.setPField(Double.toString(octave + strPch), pfield);
        }
    }

    public static void main(String[] args) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.add(Note.createNote("i1 " + i + " 2 6.0" + i + " 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        PchAddProcessor pchAdd1 = new PchAddProcessor();
        pchAdd1.setPfield("4");
        pchAdd1.setVal("-4");
        try {
            pchAdd1.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");

    }

    public static NoteProcessor loadFromXML(Element data) {
        PchAddProcessor pap = new PchAddProcessor();

        pap.setPfield(data.getElement("pfield").getTextString());
        pap.setVal(data.getElement("value").getTextString());

        return pap;
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

        retVal.addElement("pfield").setText(this.getPfield());
        retVal.addElement("value").setText(this.getVal());

        return retVal;
    }

    @Override
    public PchAddProcessor deepCopy() {
        return new PchAddProcessor(this);
    }

}