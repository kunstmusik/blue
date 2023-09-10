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

import electric.xml.Element;
import electric.xml.Elements;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Random implements Generator, Quantizable, Accumulatable {

    private double min = 0.0;

    private double max = 1.0;

    public Random() {
    }

    public Random(Random rand) {
        min = rand.min;
        max = rand.max;
    }

    public static Generator loadFromXML(Element data) {
        Random retVal = new Random();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "min":
                    retVal.min = Double.parseDouble(node.getTextString());
                    break;
                case "max":
                    retVal.max = Double.parseDouble(node.getTextString());
                    break;
            }
        }

        return retVal;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = new Element("generator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement("min").setText(Double.toString(min));
        retVal.addElement("max").setText(Double.toString(max));

        return retVal;
    }

//    public JComponent getEditor() {
//        return new RandomEditor(this);
//    }
    @Override
    public void initialize(double duration) {

    }

    @Override
    public double getValue(double time, java.util.Random rnd) {
        double range = max - min;

        return min + (range * rnd.nextDouble());
    }

    public double getMax() {
        return max;
    }

    public void setMax(double max) {
        this.max = max;
    }

    public double getMin() {
        return min;
    }

    public void setMin(double min) {
        this.min = min;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public Random deepCopy() {
        return new Random(this);
    }
}
