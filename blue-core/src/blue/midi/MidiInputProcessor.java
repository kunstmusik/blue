/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.midi;

import blue.soundObject.pianoRoll.Scale;
import blue.utility.NumberUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.text.MessageFormat;

/**
 *
 * @author syi
 */
public class MidiInputProcessor implements Serializable {

    private static final MessageFormat PCH_FORMAT = new MessageFormat("{0}.{1}");

    private static final MessageFormat NOTE_FORMAT = new MessageFormat(
            "i{0}.{1} 0 -1 {2} {3}");

    private static final MessageFormat NOTE_OFF_FORMAT = new MessageFormat(
            "i-{0}.{1} 0 0");

    private MidiKeyMapping keyMapping = MidiKeyMapping.PCH;

    private MidiVelocityMapping velMapping = MidiVelocityMapping.MIDI;

    private Scale scale = Scale.get12TET();

    private String pitchConstant = "";

    private String ampConstant = "";

    private double ampMin = 0.0;

    private double ampMax = 1.0;

    public String getAmpConstant() {
        return ampConstant;
    }

    public void setAmpConstant(String ampConstant) {
        this.ampConstant = ampConstant;
    }

    public double getAmpMax() {
        return ampMax;
    }

    public void setAmpMax(double ampMax) {
        this.ampMax = ampMax;
    }

    public double getAmpMin() {
        return ampMin;
    }

    public void setAmpMin(double ampMin) {
        this.ampMin = ampMin;
    }

    public String getPitchConstant() {
        return pitchConstant;
    }

    public void setPitchConstant(String pitchConstant) {
        this.pitchConstant = pitchConstant;
    }

    public Scale getScale() {
        return scale;
    }

    public void setScale(Scale scale) {
        this.scale = scale;
    }
    
    private String getPaddedNoteNum(int noteNum) {
        String noteStr = Integer.toString(noteNum);
        StringBuilder bdr = new StringBuilder();
        if(noteStr.length() < 3) {
            bdr.append("0");
        }
        if(noteStr.length() < 2) {
            bdr.append("1");
        }
        bdr.append(noteStr);
        
        return bdr.toString();
    }

    public String getNoteOn(String id, int noteNum, int key, int velocity) {
        return NOTE_FORMAT.format(new Object[]{id, getPaddedNoteNum(noteNum), processKey(key), processVelocity(
                    velocity)});
    }

    public String getNoteOff(String id, int noteNum) {
        return NOTE_OFF_FORMAT.format(new Object[]{id, getPaddedNoteNum(noteNum)});
    }

    protected String processKey(int key) {
        String retVal = null;

        int octave, scaleDegree, temp;

        switch (keyMapping) {
            case MIDI:
                retVal = Integer.toString(key);
                break;
            case PCH:
                retVal = convertPch(key);
                break;
            case OCT:
                retVal = convertOct(key);
                break;
            case CONSTANT:
                retVal = pitchConstant;
            case TUNING_CPS:
                temp = key - 60;
                octave = 8 + (temp / scale.getNumScaleDegrees());
                scaleDegree = temp % scale.getNumScaleDegrees();

                if (scaleDegree < 0) {
                    octave -= 1;
                    scaleDegree = scale.getNumScaleDegrees() + scaleDegree;
                }

                retVal = NumberUtilities.formatFloat(scale.getFrequency(octave,
                        scaleDegree));
                break;
            case TUNING_BLUE_PCH:
                temp = key - 60;
                octave = 8 + (temp / scale.getNumScaleDegrees());
                scaleDegree = temp % scale.getNumScaleDegrees();

                if (scaleDegree < 0) {
                    octave -= 1;
                    scaleDegree = scale.getNumScaleDegrees() + scaleDegree;
                }

                retVal = octave + "." + scaleDegree;
                break;
        }

        return retVal;
    }

    protected String convertPch(int midiKey) {
        int oct = midiKey / 12 + 3;
        int key = midiKey % 12;

        return PCH_FORMAT.format(new Object[]{oct, key < 10 ? "0" + key : key});
    }

    protected String convertOct(int midiKey) {
        return NumberUtilities.formatDouble((midiKey / 12.0) + 3.0);
    }

    protected String processVelocity(int key) {
        String retVal = null;

        switch (velMapping) {
            case MIDI:
                retVal = Integer.toString(key);
                break;
            case CONSTANT:
                retVal = ampConstant;
                break;
            case AMP:
                retVal = Double.toString(((key * key) / 16239.0) * 30000);
                break;
        }

        return retVal;
    }

    public MidiKeyMapping getKeyMapping() {
        return keyMapping;
    }

    public void setKeyMapping(MidiKeyMapping keyMapping) {
        this.keyMapping = keyMapping;
    }

    public MidiVelocityMapping getVelMapping() {
        return velMapping;
    }

    public void setVelMapping(MidiVelocityMapping velMapping) {
        this.velMapping = velMapping;
    }


    /* SERIALIZATION */
    public static MidiInputProcessor loadFromXML(Element data) {
        MidiInputProcessor processor = new MidiInputProcessor();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("keyMapping")) {
                try {
                    processor.keyMapping = MidiKeyMapping.valueOf(
                        node.getTextString());
                } catch (IllegalArgumentException iae) {

                }
            } else if (nodeName.equals("velMapping")) {
                try {
                    processor.velMapping = MidiVelocityMapping.valueOf(node.
                        getTextString());
                } catch (IllegalArgumentException iae) {

                }
            } else if (nodeName.equals("pitchConstant")) {
                processor.pitchConstant = node.getTextString();
            } else if (nodeName.equals("ampConstant")) {
                processor.ampConstant = node.getTextString();
            } else if (nodeName.equals("scale")) {
                processor.scale = Scale.loadFromXML(node);
            }
        }

        return processor;
    }

    public Element saveAsXML() {
        Element retVal = new Element("midiInputProcessor");

        retVal.addElement("keyMapping").setText(keyMapping.name());
        retVal.addElement("velMapping").setText(velMapping.name());
        retVal.addElement("pitchConstant").setText(pitchConstant);
        retVal.addElement("ampConstant").setText(ampConstant);
        retVal.addElement(scale.saveAsXML());

        return retVal;
    }
}
