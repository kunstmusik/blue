package blue.orchestra.blueX7;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
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

public class AlgorithmCommonData implements java.io.Serializable {
    public int keyTranspose = 12;

    public int algorithm = 1;

    public int feedback = 0;

    public boolean[] operators = new boolean[6];

    public AlgorithmCommonData() {
        for (int i = 0; i < operators.length; i++) {
            operators[i] = true;
        }
    }

    public static AlgorithmCommonData loadFromXML(Element data) {
        AlgorithmCommonData acd = new AlgorithmCommonData();

        acd.keyTranspose = XMLUtilities.readInt(data, "keyTranspose");
        acd.algorithm = XMLUtilities.readInt(data, "algorithm");
        acd.feedback = XMLUtilities.readInt(data, "feedback");

        Elements ops = data.getElements("operator");

        int counter = 0;
        while (ops.hasMoreElements()) {
            acd.operators[counter] = XMLUtilities.readBoolean(ops.next());
            counter++;
        }

        return acd;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("algorithmCommonData");

        retVal.addElement(XMLUtilities.writeInt("keyTranspose", keyTranspose));
        retVal.addElement(XMLUtilities.writeInt("algorithm", algorithm));
        retVal.addElement(XMLUtilities.writeInt("feedback", feedback));

        for (int i = 0; i < operators.length; i++) {
            Element elem = XMLUtilities.writeBoolean("operator", operators[i]);
            retVal.addElement(elem);
        }

        return retVal;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}