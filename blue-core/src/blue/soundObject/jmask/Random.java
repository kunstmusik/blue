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
import java.io.Serializable;
import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.builder.ToStringBuilder;

public class Random implements Generator, Serializable, Quantizable,
        Accumulatable {

    private double min = 0.0;

    private double max = 1.0;

    public static Generator loadFromXML(Element data) {
        Random retVal = new Random();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("min")) {
                retVal.min = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("max")) {
                retVal.max = Double.parseDouble(node.getTextString());
            }
        }

        return retVal;
    }

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

    public void initialize(double duration) {

    }

    public double getValue(double time) {
        double range = max - min;

        return min + (range * Math.random());
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

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}
