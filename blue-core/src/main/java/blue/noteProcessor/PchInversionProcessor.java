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

@NoteProcessorPlugin(displayName="PchInversionProcessor", position = 100)
public class PchInversionProcessor implements NoteProcessor {

    double value = 8.00f;
    int pfield = 4;

    public PchInversionProcessor() {
    }
    public PchInversionProcessor(PchInversionProcessor pip) {
        value = pip.value;
        pfield = pip.pfield;
    }

    @Override
    public String toString() {
        // return "[add] pfield: " + pfield + " value: " + value;
        return "[pch inversion]";
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        this.pfield = Integer.parseInt(pfield);
    }

    public String getVal() {
        return Double.toString(value);
    }

    public void setVal(String value) {
        this.value = Double.parseDouble(value);
    }

    @Override
    public final NoteList processNotes(NoteList in) throws NoteProcessorException {
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
            double baseTenAxis = blue.utility.ScoreUtilities.getBaseTen(this
                    .getVal());

            double addVal = -1 * (baseTen - baseTenAxis);

            baseTen = baseTenAxis + addVal;

            int octave = (int) (baseTen / 12);
            double strPch = (baseTen % 12) / 100;

            temp.setPField(Double.toString(octave + strPch), pfield);
        }
        return in;
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

        PchInversionProcessor ap = new PchInversionProcessor();
        ap.setPfield("4");
        ap.setVal("5.00");
        try {
            ap.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        PchInversionProcessor pip = new PchInversionProcessor();

        pip.setPfield(data.getElement("pfield").getTextString());
        pip.setVal(data.getElement("value").getTextString());

        return pip;
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
    public PchInversionProcessor deepCopy() {
        return new PchInversionProcessor(this);
    }
}
