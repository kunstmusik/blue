/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.tracker;

import blue.soundObject.pianoRoll.Scale;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import org.apache.commons.lang3.builder.EqualsBuilder;

public class Column implements Serializable {
    public static final int TYPE_PCH = 0;

    public static final int TYPE_BLUE_PCH = 1;

    public static final int TYPE_MIDI = 2;

    public static final int TYPE_STR = 3;

    public static final int TYPE_NUM = 4;

    public static final String[] TYPES = { "PCH", "blue PCH", "MIDI", "String",
            "Number" };

    private Scale scale;

    private boolean outputFrequency = true;

    // protected String defaultValue = "0.0";

    protected String name = "col";

    private double rangeMin = 0;

    private double rangeMax = 0;

    protected int type = TYPE_STR;

    private boolean restrictedToInteger = false;

    private boolean usingRange = false;

    public Column() {
        setScale(Scale.get12TET());
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public static class PitchColumn extends Column {
        public PitchColumn() {
            this.name = "pch";
            this.type = TYPE_PCH;
            // this.defaultValue = "8.00";
        }
    }

    public static class AmpColumn extends Column {
        public AmpColumn() {
            this.name = "db";
            this.type = TYPE_NUM;
            setRangeMax(90.0d);
            // this.defaultValue = "80";
        }
    }

    /* GETTER/SETTERS */

    public int getType() {
        return type;
    }

    public void setType(int type) {
        this.type = type;
    }

    // public String getDefaultValue() {
    // return defaultValue;
    // }

    // public void setDefaultValue(String defaultValue) {
    // this.defaultValue = defaultValue;
    // }

    public boolean isRestrictedToInteger() {
        return restrictedToInteger;
    }

    public void setRestrictedToInteger(boolean restrictedToInteger) {
        this.restrictedToInteger = restrictedToInteger;
    }

    public boolean isUsingRange() {
        return usingRange;
    }

    public void setUsingRange(boolean usingRange) {
        this.usingRange = usingRange;
    }

    public double getRangeMin() {
        return rangeMin;
    }

    public void setRangeMin(double rangeMin) {
        this.rangeMin = rangeMin;
    }

    public double getRangeMax() {
        return rangeMax;
    }

    public void setRangeMax(double rangeMax) {
        this.rangeMax = rangeMax;
    }

    public void setScale(Scale scale) {
        this.scale = scale;
    }

    public Scale getScale() {
        return scale;
    }

    public boolean isOutputFrequency() {
        return outputFrequency;
    }

    public void setOutputFrequency(boolean outputFrequency) {
        this.outputFrequency = outputFrequency;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    /* VALIDATION AND OTHER METHODS */

    public boolean isValid(final String input) {

        String val = input.trim();

        if (val.length() == 0) {
            return true;
        }

        String[] parts;

        boolean retVal = false;

        switch (type) {
            case TYPE_PCH:
                parts = val.split("\\.");

                if (parts.length != 2 || parts[0].length() == 0
                        || parts[1].length() == 0) {
                    retVal = false;
                } else {
                    try {
                        float fVal = Float.parseFloat(val);

                        retVal = true;

                    } catch (NumberFormatException nfe) {
                        retVal = false;
                    }
                }
                break;
            case TYPE_BLUE_PCH:
                parts = val.split("\\.");

                if (parts.length != 2 || parts[0].length() == 0
                        || parts[1].length() == 0) {
                    retVal = false;
                } else {
                    try {
                        int oct = Integer.parseInt(parts[0]);
                        int pch = Integer.parseInt(parts[1]);

                        if (parts[1].startsWith("0") && parts[1].length() > 1) {
                            retVal = false;
                        } else {
                            retVal = true;
                        }

                    } catch (NumberFormatException nfe) {
                        retVal = false;
                    }
                }

                break;
            case TYPE_NUM:
                try {
                    if (restrictedToInteger) {
                        int num = Integer.parseInt(val);

                        if (usingRange) {
                            retVal = (num >= (int) rangeMin && num <= (int) rangeMax);
                        } else {
                            retVal = true;
                        }
                    } else {
                        double num = Double.parseDouble(val);

                        if (usingRange) {
                            retVal = (num >= rangeMin && num <= rangeMax);
                        } else {
                            retVal = true;
                        }
                    }

                } catch (NumberFormatException nfe) {
                    retVal = false;
                }
                break;
            case TYPE_MIDI:
                try {
                    int num = Integer.parseInt(val);
                    retVal = (num >= 0 && num < 128);
                } catch (NumberFormatException nfe) {
                    retVal = false;
                }
                break;
            case TYPE_STR:
                retVal = true;
                break;
        }
        return retVal;
    }

    public String getDefaultValue() {

        String retVal = "";

        switch (type) {
            case TYPE_PCH:
            case TYPE_BLUE_PCH:
                retVal = "8.00";
                break;
            case TYPE_NUM:
                if (restrictedToInteger) {
                    retVal = Integer.toString((int) rangeMax);
                } else {
                    retVal = Double.toString(rangeMax);
                }
                break;
            case TYPE_MIDI:
                retVal = "60";
                break;
            case TYPE_STR:
                retVal = "";
                break;
        }
        return retVal;

    }

    public String getIncrementValue(String val) {
        String retVal = null;

        switch (type) {
            case TYPE_PCH:
                float baseTen = ScoreUtilities.getBaseTen(val);

                baseTen += 1.0f;

                int octave = (int) (baseTen / 12);
                float strPch = (baseTen % 12) / 100;

                retVal = Float.toString(octave + strPch);

                if (retVal.endsWith(".0") || retVal.endsWith(".1")) {
                    retVal = retVal + "0";
                }

                break;
            case TYPE_BLUE_PCH:
                String[] parts = val.split("\\.");

                int scaleDegrees = getScale().getNumScaleDegrees();

                int iBaseTen = Integer.parseInt(parts[0]) * scaleDegrees;
                iBaseTen += Integer.parseInt(parts[1]);

                iBaseTen += 1;

                int iOctave = iBaseTen / scaleDegrees;
                int iScaleDegree = iBaseTen % scaleDegrees;

                retVal = iOctave + "." + iScaleDegree;

                break;
            case TYPE_NUM:

                double dNumVal = Double.parseDouble(val);

                dNumVal += 1;

                if (usingRange && dNumVal > rangeMax) {
                    dNumVal = rangeMax;
                }

                if (restrictedToInteger) {
                    retVal = Integer.toString((int) dNumVal);
                } else {
                    retVal = Double.toString(dNumVal);
                }
                break;
            case TYPE_MIDI:

                int midiVal = Integer.parseInt(val) + 1;

                if (midiVal > 127) {
                    return null;
                }

                retVal = Integer.toString(midiVal);
                break;
            case TYPE_STR:
                retVal = null;
                break;
        }

        return retVal;
    }

    public String getDecrementValue(String val) {
        String retVal = null;

        switch (type) {
            case TYPE_PCH:
                float baseTen = ScoreUtilities.getBaseTen(val);

                baseTen -= 1.0f;

                int octave = (int) (baseTen / 12);
                float strPch = (baseTen % 12) / 100;

                retVal = Float.toString(octave + strPch);

                if (retVal.endsWith(".0") || retVal.endsWith(".1")) {
                    retVal = retVal + "0";
                }

                break;

            case TYPE_BLUE_PCH:
                String[] parts = val.split("\\.");

                int scaleDegrees = getScale().getNumScaleDegrees();

                int iBaseTen = Integer.parseInt(parts[0]) * scaleDegrees;
                iBaseTen += Integer.parseInt(parts[1]);

                iBaseTen -= 1;

                int iOctave = iBaseTen / scaleDegrees;
                int iScaleDegree = iBaseTen % scaleDegrees;

                retVal = iOctave + "." + iScaleDegree;

                break;
            case TYPE_NUM:

                double dNumVal = Double.parseDouble(val);

                dNumVal -= 1;

                if (usingRange && dNumVal < rangeMin) {
                    dNumVal = rangeMin;
                }

                if (restrictedToInteger) {
                    retVal = Integer.toString((int) dNumVal);
                } else {
                    retVal = Double.toString(dNumVal);
                }
                break;
            case TYPE_MIDI:

                int midiVal = Integer.parseInt(val) - 1;

                if (midiVal < 0) {
                    return null;
                }

                retVal = Integer.toString(midiVal);
                break;
            case TYPE_STR:
                retVal = null;
                break;
        }

        return retVal;
    }

    /* SERIALIZATION METHODS */

    public Element saveAsXML() {
        Element retVal = new Element("track");

        // retVal.addElement("defaultValue").setText(defaultValue);
        retVal.addElement("name").setText(name);
        retVal.addElement(XMLUtilities.writeDouble("rangeMin", rangeMin));
        retVal.addElement(XMLUtilities.writeDouble("rangeMax", rangeMax));
        retVal.addElement(XMLUtilities.writeInt("type", type));
        retVal.addElement(XMLUtilities.writeBoolean("restrictedToInteger",
                restrictedToInteger));
        retVal.addElement(XMLUtilities.writeBoolean("usingRange", usingRange));
        retVal.addElement(getScale().saveAsXML());
        retVal.addElement(XMLUtilities.writeBoolean("outputFrequency",
                outputFrequency));

        return retVal;
    }

    public static Column loadFromXML(Element data) {
        Column retVal = new Column();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            String nodeVal = node.getTextString();
            switch (nodeName) {
                case "scale":
                    retVal.setScale(Scale.loadFromXML(node));
                    break;
                case "outputFrequency":
                    retVal.outputFrequency = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "name":
                    retVal.name = nodeVal;
                    break;
                case "rangeMin":
                    retVal.rangeMin = Double.parseDouble(nodeVal);
                    break;
                case "rangeMax":
                    retVal.rangeMax = Double.parseDouble(nodeVal);
                    break;
                case "type":
                    retVal.type = Integer.parseInt(nodeVal);
                    break;
                case "restrictedToInteger":
                    retVal.restrictedToInteger = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "usingRange":
                    retVal.usingRange = Boolean.valueOf(nodeVal).booleanValue();
                    break;
            }
        }

        return retVal;
    }

}
