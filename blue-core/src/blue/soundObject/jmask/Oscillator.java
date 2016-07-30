/*
 * blue - object composition environment for csound
 * Copyright (c) 2007 Steven Yi (stevenyi@gmail.com)
 *
 * Based on CMask by Andre Bartetzki
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
package blue.soundObject.jmask;

import blue.utility.MathUtils;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Oscillator implements Generator, Serializable, Maskable,
        Quantizable, Accumulatable {

    public static final int SINE = 0;

    public static final int COSINE = 1;

    public static final int SAW_UP = 2;

    public static final int SAW_DOWN = 3;

    public static final int SQUARE = 4;

    public static final int TRIANGLE = 5;

    public static final int POW_UP = 6;

    public static final int POW_DOWN = 7;

    private static final double PI2 = Math.PI * 2;

    public static final String[] FUNCTIONS = { "Sine", "Cosine",
            "Saw (Increasing)", "Saw (Decreasing)", "Square", "Triangle",
            "Power Function (Increasing)", "Power Function (Decreasing)" };

    private int oscillatorType = SINE;

    double phaseInit = 0.0;

    private double frequency = 1.0;

    private Table freqTable = new Table();

    private boolean freqTableEnabled = false;

    double exponent = 1.0;
    
    public Oscillator() {
        freqTable.setMin(.001, false);
        freqTable.setMax(10, false);
        
        TablePoint point1 = (TablePoint) freqTable.points.get(0);
        TablePoint point2 = (TablePoint) freqTable.points.get(1);
        
        point1.setValue(1);
        point2.setValue(1);
    }

    public static Generator loadFromXML(Element data) {
        Oscillator retVal = new Oscillator();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "oscillatorType":
                    retVal.oscillatorType = Integer.parseInt(node.getTextString());
                    break;
                case "phaseInit":
                    retVal.phaseInit = Double.parseDouble(node.getTextString());
                    break;
                case "frequency":
                    retVal.setFrequency(Double.parseDouble(node.getTextString()));
                    break;
                case "freqTableEnabled":
                    retVal.setFreqTableEnabled(Boolean
                            .valueOf(node.getTextString()).booleanValue());
                    break;
                case "table":
                    retVal.setFreqTable(Table.loadFromXML(node));
                    break;
                case "exponent":
                    retVal.exponent = Double.parseDouble(node.getTextString());
                    break;
            }

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("generator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeInt("oscillatorType",
                oscillatorType));
        retVal.addElement(XMLUtilities.writeDouble("phaseInit", phaseInit));
        retVal
                .addElement(XMLUtilities.writeDouble("frequency",
                        getFrequency()));
        retVal.addElement(XMLUtilities.writeBoolean("freqTableEnabled",
                isFreqTableEnabled()));
        retVal.addElement(getFreqTable().saveAsXML());
        retVal.addElement(XMLUtilities.writeDouble("exponent", exponent));

        return retVal;
    }

//    public JComponent getEditor() {
//        return new OscillatorEditor(this);
//    }

    public double getExponent() {
        return exponent;
    }

    public void setExponent(double exponent) {
        this.exponent = exponent;
    }

    public int getOscillatorType() {
        return oscillatorType;
    }

    public void setOscillatorType(int oscillatorType) {
        this.oscillatorType = oscillatorType;
    }

    public void initialize(double duration) {
//        freqTable.setInitialPhase(phaseInit);
    }

    public double getValue(double time, java.util.Random rnd) {
        double retVal = 0.0;

        double phase = getPhase(time);

        switch (oscillatorType) {
            case SINE:
                retVal = sin(phase);
                break;
            case COSINE:
                retVal = cos(phase);
                break;
            case SAW_UP:
                retVal = sawup(phase);
                break;
            case SAW_DOWN:
                retVal = sawdown(phase);
                break;
            case SQUARE:
                retVal = square(phase);
                break;
            case TRIANGLE:
                retVal = triangle(phase);
                break;
            case POW_UP:
                retVal = powerup(phase);
                break;
            case POW_DOWN:
                retVal = powerdown(phase);
                break;
        }

        return retVal;
    }

    private double getPhase(double time) {
        double retVal = 0.0;
        
        if (!freqTableEnabled) {
            retVal = phaseInit + (time * frequency);
        } else {
            retVal = phaseInit + freqTable.getphs(time);
        }

        return retVal;
    }

    public double getPhaseInit() {
        return phaseInit;
    }

    public void setPhaseInit(double phaseInit) {
        this.phaseInit = phaseInit;
    }

    private double sin(double phpt) {
        return Math.sin(PI2 * phpt) * 0.5 + 0.5;
    }

    private double cos(double phpt) {
        return Math.cos(PI2 * phpt) * 0.5 + 0.5;
    }

    private double sawup(double phpt) {
        System.err.println("Phase: " + phpt + " Value: "
                + MathUtils.remainder(phpt, 1.0));
        return Math.abs(MathUtils.remainder(phpt, 1.0));
    }

    private double sawdown(double phpt) {
        return 1.0 - Math.abs(MathUtils.remainder(phpt, 1.0));
    }

    private double square(double phpt) {
        double x;
        x = Math.abs(MathUtils.remainder(phpt, 1.0));
        return (x < 0.5 ? 1.0 : 0.0);
    }

    private double triangle(double phpt) {
        double x;
        x = Math.abs(MathUtils.remainder(phpt, 1.0));
        return (x < 0.5 ? (2.0 * x) : (2.0 * (1.0 - x)));
    }

    private double powerup(double phpt) {
        return Math.pow(Math.abs(MathUtils.remainder(phpt, 1.0)), Math.pow(2.0,
                exponent));
    }

    private double powerdown(double phpt) {
        return Math.pow(1.0 - Math.abs(MathUtils.remainder(phpt, 1.0)), Math
                .pow(2.0, exponent));
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public double getFrequency() {
        return frequency;
    }

    public void setFrequency(double frequency) {
        this.frequency = frequency;
    }

    public Table getFreqTable() {
        return freqTable;
    }

    public void setFreqTable(Table freqTable) {
        this.freqTable = freqTable;
    }

    public boolean isFreqTableEnabled() {
        return freqTableEnabled;
    }

    public void setFreqTableEnabled(boolean freqTableEnabled) {
        this.freqTableEnabled = freqTableEnabled;
    }
}
