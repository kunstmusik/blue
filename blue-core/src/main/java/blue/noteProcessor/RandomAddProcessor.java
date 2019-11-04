package blue.noteProcessor;

import blue.BlueSystem;
import blue.plugin.NoteProcessorPlugin;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.Random;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

@NoteProcessorPlugin(displayName="RandomAddProcessor", position = 40)
public class RandomAddProcessor implements NoteProcessor {

    int pfield = 4;

    double min = 0.0;

    double max = 1.0;
    
    boolean seedUsed = false;
    
    long seed = 0L;

    public RandomAddProcessor() {
    }
    public RandomAddProcessor(RandomAddProcessor rap) {
        pfield = rap.pfield;
        min = rap.min;
        max = rap.max;
        seedUsed = rap.seedUsed;
        seed = rap.seed;
    }

    @Override
    public String toString() {
        return "[random add]";
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        this.pfield = Integer.parseInt(pfield);
    }

    public String getMin() {
        return Double.toString(min);
    }

    public void setMin(String value) {
        this.min = Double.parseDouble(value);
    }

    public String getMax() {
        return Double.toString(max);
    }

    public void setMax(String value) {
        this.max = Double.parseDouble(value);
    }

    public String getSeedUsed() {
        return Boolean.toString(seedUsed);
    }

    public void setSeedUsed(String seedUsed) {
        this.seedUsed = Boolean.valueOf(seedUsed.trim().toLowerCase());
    }

    public String getSeed() {
        return Long.toString(seed);
    }

    public void setSeed(String seed) {
        this.seed = Long.parseLong(seed);
    }
    
    @Override
    public final void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;

        double range = max - min;
        double fieldVal = 0.0;

        Random r = seedUsed ? new Random(seed) : new Random();

        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);
            try {
                fieldVal = Double.parseDouble(temp.getPField(pfield));
            } catch (NumberFormatException ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.pfieldNotDouble"),
                        pfield);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }
            double randVal = (double) ((r.nextDouble() * range) + min);

            temp.setPField(Double.toString(fieldVal + randVal), pfield);
        }
    }

    public static NoteProcessor loadFromXML(Element data) {
        RandomAddProcessor rap = new RandomAddProcessor();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "pfield":
                    rap.setPfield(node.getTextString());
                    break;
                case "min":
                    rap.setMin(node.getTextString());
                    break;
                case "max":
                    rap.setMax(node.getTextString());
                    break;
                case "seedUsed":
                    rap.setSeedUsed(node.getTextString());
                    break;
                case "seed":
                    rap.setSeed(node.getTextString());
                    break;
            }
        }

        return rap;
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
        retVal.addElement("min").setText(this.getMin());
        retVal.addElement("max").setText(this.getMax());
        retVal.addElement("seedUsed").setText(this.getSeedUsed());
        retVal.addElement("seed").setText(this.getSeed());

        return retVal;
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

        RandomAddProcessor rap = new RandomAddProcessor();
        rap.setPfield("4");
        rap.setMin("0f");
        rap.setMax("1.5f");
        try {
            rap.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    @Override
    public RandomAddProcessor deepCopy() {
        return new RandomAddProcessor(this);
    }
}
