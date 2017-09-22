package blue.orchestra.blueX7;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import org.apache.commons.lang3.builder.EqualsBuilder;

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
public class LFOData {

    public int speed = 0;

    public int delay = 0;

    public int PMD = 0;

    public int AMD = 0;

    public int wave = 0;

    public int sync = 0;

    public LFOData() {
    }

    public LFOData(LFOData lfo) {
        speed = lfo.speed;
        delay = lfo.delay;
        PMD = lfo.PMD;
        AMD = lfo.AMD;
        wave = lfo.wave;
        sync = lfo.sync;
    }

    /**
     * @return
     */
    public static LFOData loadFromXML(Element data) {
        LFOData lfo = new LFOData();

        lfo.speed = XMLUtilities.readInt(data, "speed");
        lfo.delay = XMLUtilities.readInt(data, "delay");
        lfo.PMD = XMLUtilities.readInt(data, "PMD");
        lfo.AMD = XMLUtilities.readInt(data, "AMD");
        lfo.wave = XMLUtilities.readInt(data, "wave");
        lfo.sync = XMLUtilities.readInt(data, "sync");

        return lfo;
    }

    public Element saveAsXML() {
        Element retVal = new Element("lfoData");

        retVal.addElement(XMLUtilities.writeInt("speed", speed));
        retVal.addElement(XMLUtilities.writeInt("delay", delay));
        retVal.addElement(XMLUtilities.writeInt("PMD", PMD));
        retVal.addElement(XMLUtilities.writeInt("AMD", AMD));
        retVal.addElement(XMLUtilities.writeInt("wave", wave));
        retVal.addElement(XMLUtilities.writeInt("sync", sync));

        return retVal;

    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}
