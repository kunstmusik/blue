/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.noteProcessor;

import blue.BlueSystem;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.pianoRoll.Scale;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.File;
import java.io.Serializable;

/**
 * @author Steven Yi
 */
public class TuningProcessor implements NoteProcessor, Serializable {

    // String fileName = "";
    // File tuningFile;

    Scale scale = Scale.get12TET();

    int pfield = 4;

    @Override
    public String toString() {
        return "[tuning]";
    }

    public void processNotes(NoteList in) throws NoteProcessorException {

        Note temp;
        int pcount = 0;
        float freq = 0f;
        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);

            // verify pfield
            pcount = temp.getPCount();
            if (pfield < 1 || pfield > pcount) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }

            String val = temp.getPField(pfield).trim();

            try {
                freq = convert(val, scale);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.scaleFileConvert"),
                        pfield);
            }

            temp.setPField(Float.toString(freq), pfield);
        }

    }

    /**
     * @param val
     * @param baseFrequency2
     * @param octave
     * @param intervals
     * @return
     */
    private float convert(String val, Scale scale) {

        int oct;
        float pch;

        int index = val.indexOf('.');

        if (index == -1) {
            oct = Integer.parseInt(val);
            pch = 0.0f;
        } else {
            oct = Integer.parseInt(val.substring(0, index));
            pch = Float.parseFloat(val.substring(index + 1));
        }

        int pitchIndex = (int) pch;
        int numScaleDegrees = scale.getNumScaleDegrees();
        
        if (pitchIndex >= numScaleDegrees) {
            oct += pitchIndex / numScaleDegrees;
            pitchIndex = pitchIndex % numScaleDegrees;
        }
        
        return scale.getFrequency(oct, pitchIndex);
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

    public static NoteProcessor loadFromXML(Element data) {
        TuningProcessor tp = new TuningProcessor();

        Elements nodes = data.getElements();

        float baseFreq = -1;
        
        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "baseFrequency":
                    baseFreq = Float.parseFloat(node.getTextString());
                    break;
                case "pfield":
                    tp.setPfield(node.getTextString());
                    break;
                case "scale":
                    Scale scale;
                    if(node.getElements().size() == 0) {
                        
                        String scaleDir = BlueSystem.getUserConfigurationDirectory()
                            + File.separator + "scl";
                        String scalePath = scaleDir + File.separator + node.getTextString();
                        File scaleFile = new File(scalePath);
                        
                        scale = Scale.loadScale(scaleFile);
                    } else {
                        scale = Scale.loadFromXML(node);
                    }
                    tp.setScale(scale);
                    break;
            }
        }
        
        if(baseFreq > 0) {
            tp.getScale().setBaseFrequency(baseFreq);
        }

        // tp.setBaseFrequency(data.getElement("baseFrequency").getTextString());
        // tp.setFileName(data.getElement("fileName").getTextString());

        return tp;
    }

    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        //retVal.addElement("baseFrequency").setText(this.getBaseFrequency());
        // retVal.addElement("tuning").setText(this.getTuningFile().get);
        retVal.addElement("pfield").setText(Integer.toString(this.pfield));
        retVal.addElement(scale.saveAsXML());

        return retVal;
    }

    /**
     * @return Returns the scale.
     */
    public Scale getScale() {
        return scale;
    }

    /**
     * @param scale
     *            The scale to set.
     */
    public void setScale(Scale scale) {
        this.scale = scale;
    }
    
    public String getBaseFrequency() {
        return Float.toString(this.scale.getBaseFrequency());
    }

    public void setBaseFrequency(String baseFrequency) {
        this.scale.setBaseFrequency(Float.parseFloat(baseFrequency));
    }

    public static void main(String[] args) {
        NoteList n = new NoteList();

        for (int i = 0; i < 30; i++) {
            try {
                n.add(Note.createNote("i1 " + i + " " + i + " 6." + i
                        + " 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        TuningProcessor tp = new TuningProcessor();
        tp.setPfield("4");
        try {
            tp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");

    }

}
