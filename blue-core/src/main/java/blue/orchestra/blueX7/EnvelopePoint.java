package blue.orchestra.blueX7;

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
public class EnvelopePoint {

    public int x = 0;
    public int y = 0;

    public EnvelopePoint() {
    }

    public EnvelopePoint(EnvelopePoint ep) {
        x = ep.x;
        y = ep.y;
    }

    /**
     * @return
     */
    public static EnvelopePoint loadFromXML(Element data) {
        EnvelopePoint env = new EnvelopePoint();

        env.x = Integer.parseInt(data.getAttributeValue("x"));
        env.y = Integer.parseInt(data.getAttributeValue("y"));

        return env;
    }

    public Element saveAsXML() {
        Element retVal = new Element("envelopePoint");

        retVal.setAttribute("x", Integer.toString(x));
        retVal.setAttribute("y", Integer.toString(y));

        return retVal;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}
