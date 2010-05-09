package blue.noteProcessor;

import blue.BlueSystem;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class RandomMultiplyProcessor implements NoteProcessor,
        java.io.Serializable {

    int pfield = 4;

    float min = 0f;

    float max = 1f;

    public RandomMultiplyProcessor() {
    }

    public String toString() {
        return "[random multiply]";
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        this.pfield = Integer.parseInt(pfield);
    }

    public String getMin() {
        return Float.toString(min);
    }

    public void setMin(String value) {
        this.min = Float.parseFloat(value);
    }

    public String getMax() {
        return Float.toString(max);
    }

    public void setMax(String value) {
        this.max = Float.parseFloat(value);
    }

    public final void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;

        float range = max - min;
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

            float randVal = (float) ((Math.random() * range) + min);

            temp.setPField(Float.toString(fieldVal * randVal), pfield);
        }
    }

    public static NoteProcessor loadFromXML(Element data) {
        RandomMultiplyProcessor mp = new RandomMultiplyProcessor();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            if (node.getName().equals("pfield")) {
                mp.setPfield(node.getTextString());
            } else if (node.getName().equals("min")) {
                mp.setMin(node.getTextString());
            } else if (node.getName().equals("max")) {
                mp.setMax(node.getTextString());
            }
        }

        return mp;
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
        retVal.addElement("min").setText(this.getMin());
        retVal.addElement("max").setText(this.getMax());

        return retVal;
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

        RandomMultiplyProcessor mp = new RandomMultiplyProcessor();
        mp.setPfield("3");
        mp.setMin("1f");
        mp.setMax("1.5f");
        try {
            mp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }
}