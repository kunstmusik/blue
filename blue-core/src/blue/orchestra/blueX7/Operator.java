package blue.orchestra.blueX7;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.text.StrBuilder;

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

public class Operator implements java.io.Serializable {
    public int mode = 0;

    public int sync = 0;

    public int freqCoarse = 0;

    public int freqFine = 0;

    public int detune = 0;

    public int breakpoint = 0;

    public int curveLeft = 0;

    public int curveRight = 0;

    public int depthLeft = 0;

    public int depthRight = 0;

    public int keyboardRateScaling = 0;

    public int outputLevel = 99;

    public int velocitySensitivity = 0;

    public int modulationAmplitude = 0;

    public int modulationPitch = 0;

    public EnvelopePoint[] envelopePoints = new EnvelopePoint[4];

    public Operator() {
        for (int i = 0; i < envelopePoints.length; i++) {
            envelopePoints[i] = new EnvelopePoint();
        }
    }

    public String toString() {
        StrBuilder buffer = new StrBuilder();
        buffer.append("[operator]\n");
        buffer.append("mode: " + mode + "\n");
        buffer.append("sync: " + sync + "\n");
        buffer.append("freqCoarse: " + freqCoarse + "\n");
        buffer.append("freqFine: " + freqFine + "\n");
        buffer.append("detune: " + detune + "\n");

        return buffer.toString();
    }

    public static Operator loadFromXML(Element data) {
        Operator op = new Operator();

        op.mode = XMLUtilities.readInt(data, "mode");
        op.sync = XMLUtilities.readInt(data, "sync");
        op.freqCoarse = XMLUtilities.readInt(data, "freqCoarse");
        op.freqFine = XMLUtilities.readInt(data, "freqFine");
        op.detune = XMLUtilities.readInt(data, "detune");
        op.breakpoint = XMLUtilities.readInt(data, "breakpoint");
        op.curveLeft = XMLUtilities.readInt(data, "curveLeft");
        op.curveRight = XMLUtilities.readInt(data, "curveRight");
        op.depthLeft = XMLUtilities.readInt(data, "depthLeft");
        op.depthRight = XMLUtilities.readInt(data, "depthRight");
        op.keyboardRateScaling = XMLUtilities.readInt(data,
                "keyboardRateScaling");
        op.outputLevel = XMLUtilities.readInt(data, "outputLevel");
        op.velocitySensitivity = XMLUtilities.readInt(data,
                "velocitySensitivity");
        op.modulationAmplitude = XMLUtilities.readInt(data,
                "modulationAmplitude");
        op.modulationPitch = XMLUtilities.readInt(data, "modulationPitch");

        Elements envPoints = data.getElements("envelopePoint");
        int counter = 0;

        while (envPoints.hasMoreElements()) {
            op.envelopePoints[counter] = EnvelopePoint.loadFromXML(envPoints
                    .next());
            counter++;
        }

        return op;

    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("operator");

        retVal.addElement(XMLUtilities.writeInt("mode", mode));
        retVal.addElement(XMLUtilities.writeInt("sync", sync));
        retVal.addElement(XMLUtilities.writeInt("freqCoarse", freqCoarse));
        retVal.addElement(XMLUtilities.writeInt("freqFine", freqFine));
        retVal.addElement(XMLUtilities.writeInt("detune", detune));
        retVal.addElement(XMLUtilities.writeInt("breakpoint", breakpoint));
        retVal.addElement(XMLUtilities.writeInt("curveLeft", curveLeft));
        retVal.addElement(XMLUtilities.writeInt("curveRight", curveRight));
        retVal.addElement(XMLUtilities.writeInt("depthLeft", depthLeft));
        retVal.addElement(XMLUtilities.writeInt("depthRight", depthRight));
        retVal.addElement(XMLUtilities.writeInt("keyboardRateScaling",
                keyboardRateScaling));
        retVal.addElement(XMLUtilities.writeInt("outputLevel", outputLevel));
        retVal.addElement(XMLUtilities.writeInt("velocitySensitivity",
                velocitySensitivity));
        retVal.addElement(XMLUtilities.writeInt("modulationAmplitude",
                modulationAmplitude));
        retVal.addElement(XMLUtilities.writeInt("modulationPitch",
                modulationPitch));

        for (int i = 0; i < envelopePoints.length; i++) {
            retVal.addElement(envelopePoints[i].saveAsXML());
        }

        return retVal;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}