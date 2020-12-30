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
package blue.soundObject.pianoRoll;

import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.HashCodeBuilder;

/**
 * @author steven
 */
public class Scale {

    private String scaleName = "";

    private double[] ratios;

    private double baseFrequency = 261.625565; // MIDDLE C

    private double octave = 2.0;

    private transient final PropertyChangeSupport pcs;

    private Scale() {
        pcs = new PropertyChangeSupport(this);
    }

    public Scale(Scale scale) {
        pcs = new PropertyChangeSupport(this);
        scaleName = scale.scaleName;
        ratios = scale.ratios.clone();
        baseFrequency = scale.baseFrequency;
        octave = scale.octave;
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
                scale.ratios = new double[pitchCount];
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
        retrVal.ratios = new double[12];

        double ratio = Math.pow(2.0, 1.0 / 12.0);

        for (int i = 0; i < retrVal.ratios.length; i++) {
            retrVal.ratios[i] = Math.pow(ratio, i);
        }

        return retrVal;
    }

    private static double getMultiplier(String lineInput) {
        double multiplier = 0.0f;

        String line = removeComments(lineInput);

        if (line.indexOf('/') > -1) {

            String[] vals = line.split("/");
            multiplier = Double.parseDouble(vals[0]) / Double.parseDouble(vals[1]);
        } else if (line.indexOf('.') > -1) {
            double cents = Double.parseDouble(line);
            multiplier = Math.pow(2, cents / 1200);
        } else { // assume ratio
            multiplier = Double.parseDouble(line);
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

    public double getFrequency(int octave, int scaleDegree) {

        int oct = octave;

        int pitchIndex = scaleDegree;

        if (pitchIndex >= ratios.length) {
            oct += pitchIndex / ratios.length;
            pitchIndex = pitchIndex % ratios.length;
        }

        double multiplier = oct - 8;

        multiplier = Math.pow(this.octave, multiplier);

        double newBase = multiplier * baseFrequency;

        return newBase * ratios[pitchIndex];
    }

    /* SERIALIZATION */
    public static Scale loadFromXML(Element data) {
        Scale scale = new Scale();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "scaleName":
                    scale.scaleName = node.getTextString();
                    break;
                case "baseFrequency":
                    scale.baseFrequency = Double.parseDouble(node.getTextString());
                    break;
                case "octave":
                    scale.octave = Double.parseDouble(node.getTextString());
                    break;
                case "ratios":
                    Elements ratioNodes = node.getElements();
                    scale.ratios = new double[ratioNodes.size()];
                    int i = 0;
                    while (ratioNodes.hasMoreElements()) {
                        Element ratioNode = ratioNodes.next();
                        scale.ratios[i] = Double.parseDouble(ratioNode
                                .getTextString());
                        i++;
                    }
                    break;

            }
        }

        return scale;
    }

    public Element saveAsXML() {
        Element retVal = new Element("scale");

        retVal.addElement("scaleName").setText(scaleName);
        retVal.addElement("baseFrequency").setText(
                Double.toString(baseFrequency));
        retVal.addElement("octave").setText(Double.toString(octave));

        Element ratiosNode = retVal.addElement("ratios");

        for (int i = 0; i < ratios.length; i++) {
            Element node = new Element("ratio").setText(Double
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
     * @param scaleName The scaleName to set.
     */
    public void setScaleName(String scaleName) {
        this.scaleName = scaleName;
    }

    /**
     * @return Returns the baseFrequency.
     */
    public double getBaseFrequency() {
        return baseFrequency;
    }

    /**
     * @param baseFrequency The baseFrequency to set.
     */
    public void setBaseFrequency(double baseFrequency) {
        var oldVal = this.baseFrequency;
        this.baseFrequency = baseFrequency;
        pcs.firePropertyChange("baseFrequency", oldVal, baseFrequency);
    }
    
    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        pcs.addPropertyChangeListener(pcl);
    }
    
    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        pcs.removePropertyChangeListener(pcl);
    }
            

    public void copyValues(Scale scale) {
        this.octave = scale.octave;
        this.ratios = scale.ratios;
        this.scaleName = scale.scaleName;
        this.baseFrequency = scale.baseFrequency;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public int hashCode() {
        return HashCodeBuilder.reflectionHashCode(this);
    }

    @Override
    public String toString() {
        return getScaleName();
    }
}
