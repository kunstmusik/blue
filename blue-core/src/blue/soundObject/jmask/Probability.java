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

import blue.soundObject.jmask.probability.*;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Probability implements Generator, Maskable,
        Quantizable, Accumulatable {

    ProbabilityGenerator[] generators;
    private int selectedIndex = 0;

    private transient double duration = 0;

    public Probability() {
        generators = new ProbabilityGenerator[]{
            new Uniform(), new Linear(), new Triangle(), new Exponential(), 
            new Gaussian(), new Cauchy(), new Beta(), new Weibull()
        };
    }

    public Probability(Probability prob) {
        selectedIndex = prob.selectedIndex;
        generators = new ProbabilityGenerator[prob.generators.length];
        for(int i = 0; i <generators.length; i++) {
            generators[i] = prob.generators[i].deepCopy();
        }
    }

    public static Generator loadFromXML(Element data) throws Exception {
        Probability retVal = new Probability();

        Elements nodes = data.getElements();

        int generatorIndex = 0;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "selectedIndex":
                    retVal.setSelectedIndex(Integer.parseInt(node.getTextString()));
                    break;
                case "probabilityGenerator":
                    retVal.generators[generatorIndex] = (ProbabilityGenerator) ObjectUtilities
                            .loadFromXML(node);
                    generatorIndex++;
                    break;
            }
        }

        return retVal;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = new Element("generator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(
                XMLUtilities.writeInt("selectedIndex", getSelectedIndex()));

        for (ProbabilityGenerator generator : generators) {
            retVal.addElement(generator.saveAsXML());
        }

        return retVal;
    }

//    public JComponent getEditor() {
//        return new ProbabilityEditor(this);
//    }
    @Override
    public void initialize(double duration) {
        this.duration = duration;
    }

    @Override
    public double getValue(double time, java.util.Random rnd) {
        return generators[selectedIndex].getValue(time / duration, rnd);
    }

    public ProbabilityGenerator[] getGenerators() {
        return generators;
    }

    public static void main(String args[]) {
        Probability prob = new Probability();
        ProbabilityGenerator[] generators2 = prob.getGenerators();

        for (int i = 0; i < generators2.length; i++) {
            System.out.println("Generator: " + generators2[i].getName());
        }
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public int getSelectedIndex() {
        return selectedIndex;
    }

    public void setSelectedIndex(int selectedIndex) {
        this.selectedIndex = selectedIndex;
    }

    public ProbabilityGenerator getSelectedProbabilityGenerator() {
        return generators[selectedIndex];
    }

    @Override
    public Probability deepCopy() {
        return new Probability(this);
    }
}
