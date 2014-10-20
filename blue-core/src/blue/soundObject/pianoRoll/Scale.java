/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.pianoRoll;

import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.HashCodeBuilder;

/**
 * @author steven
 */

public class Scale implements Serializable {

    private String scaleName = "";

    private float[] ratios;

    private float baseFrequency = 261.625565f; // MIDDLE C

    private float octave = 2.0f;

    private Scale() {
    }

    public static Scale loadScale(File scalaFile) {
        Scale scale = new Scale();
        scale.setScaleName(scalaFile.getName());

        ArrayList lines;

        try {
            /*
             * Scala is capable of writing a .scl file with no description,
             * which results in an empty line. Parsing it as a series of lines
             * allows us to "see" the empty line and handle it properly, whereas
             * using StringTokenizer("\n") makes the empty line "disappear",
             * resulting in a parsing error. This approach is probably faster as
             * well.
             */
            lines = TextUtilities.getLinesFromFile(scalaFile, true);
        } catch (FileNotFoundException e) {
            e.printStackTrace();
            return null;
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }

        int lineCount = 0;
        int pitchCount = 0;
        int index = 0;

        int count = lines.size();
        for (int i = 0; i < count; i++) {
            String line = (String) lines.get(i);

            if (line.startsWith("!")) {
                // Comment
                continue;
            }

            if (lineCount == 0) {
                // Description Line
                // scale.scaleName = line.trim();
            } else if (lineCount == 1) {
                // Pitch count
                pitchCount = Integer.parseInt(line);
                scale.ratios = new float[pitchCount];
                scale.ratios[0] = 1.0f;
                index++;
            } else {
                // Ratios
                if (scale.ratios != null) {
                    if (index == scale.ratios.length) {
                        scale.octave = getMultiplier(line);
                    } else {
                        scale.ratios[index] = getMultiplier(line);
                        index++;
                    }
                }
            }

            lineCount++;
        }

        return scale;
    }

    public static Scale get12TET() {
        Scale retrVal = new Scale();

        retrVal.scaleName = "12TET";
        retrVal.ratios = new float[12];

        double ratio = Math.pow(2.0, 1.0 / 12.0);

        for (int i = 0; i < retrVal.ratios.length; i++) {
            retrVal.ratios[i] = (float) Math.pow(ratio, i);
        }

        return retrVal;
    }

    private static float getMultiplier(String lineInput) {
        float multiplier = 0.0f;

        String line = removeComments(lineInput);

        if (line.indexOf('/') > -1) {

            String[] vals = line.split("/");
            multiplier = Float.parseFloat(vals[0]) / Float.parseFloat(vals[1]);
        } else if (line.indexOf('.') > -1) {
            float cents = Float.parseFloat(line);
            multiplier = (float) Math.pow(2, cents / 1200);
        } else { // assume ratio
            multiplier = Float.parseFloat(line);
        }

        return multiplier;
    }

    private static String removeComments(String line) {
        if (line.indexOf(' ') > -1) {
            return line.substring(0, line.indexOf(' '));
        }

        if (line.indexOf('\t') > -1) {
            return line.substring(0, line.indexOf('\t'));
        }

        return line;
    }

    /* CONVERSION METHODS */

    public int getNumScaleDegrees() {
        return ratios.length;
    }

    public float getFrequency(int octave, int scaleDegree) {

        int oct = octave;

        int pitchIndex = scaleDegree;

        if (pitchIndex >= ratios.length) {
            oct += pitchIndex / ratios.length;
            pitchIndex = pitchIndex % ratios.length;
        }

        float multiplier = oct - 8;

        multiplier = (float) Math.pow(this.octave, multiplier);

        float newBase = multiplier * baseFrequency;

        return newBase * ratios[pitchIndex];
    }

    /* SERIALIZATION */

    public static Scale loadFromXML(Element data) {
        Scale scale = new Scale();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("scaleName")) {
                scale.scaleName = node.getTextString();
            } else if (nodeName.equals("baseFrequency")) {
                scale.baseFrequency = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("octave")) {
                scale.octave = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("ratios")) {
                Elements ratioNodes = node.getElements();

                scale.ratios = new float[ratioNodes.size()];

                int i = 0;

                while (ratioNodes.hasMoreElements()) {
                    Element ratioNode = ratioNodes.next();
                    scale.ratios[i] = Float.parseFloat(ratioNode
                            .getTextString());
                    i++;
                }

            }
        }

        return scale;
    }

    public Element saveAsXML() {
        Element retVal = new Element("scale");

        retVal.addElement("scaleName").setText(scaleName);
        retVal.addElement("baseFrequency").setText(
                Float.toString(baseFrequency));
        retVal.addElement("octave").setText(Float.toString(octave));

        Element ratiosNode = retVal.addElement("ratios");

        for (int i = 0; i < ratios.length; i++) {
            Element node = new Element("ratio").setText(Float
                    .toString(ratios[i]));
            ratiosNode.addElement(node);
        }

        return retVal;
    }

    /**
     * @return Returns the scaleName.
     */
    public String getScaleName() {
        return scaleName;
    }

    /**
     * @param scaleName
     *            The scaleName to set.
     */
    public void setScaleName(String scaleName) {
        this.scaleName = scaleName;
    }

    /**
     * @return Returns the baseFrequency.
     */
    public float getBaseFrequency() {
        return baseFrequency;
    }

    /**
     * @param baseFrequency
     *            The baseFrequency to set.
     */
    public void setBaseFrequency(float baseFrequency) {
        this.baseFrequency = baseFrequency;
    }

    public void copyValues(Scale scale) {
        this.octave = scale.octave;
        this.ratios = scale.ratios;
        this.scaleName = scale.scaleName;
        this.baseFrequency = scale.baseFrequency;
    }
    
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public int hashCode() {
        return HashCodeBuilder.reflectionHashCode(this);
    }
    
    public String toString() {
        return getScaleName();
    }
}