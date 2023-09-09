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

public class Constant implements Generator, Accumulatable {

    double value = 1.0d;

    public Constant() {
    }

    public Constant(Constant constant) {
        value = constant.value;
    }

    public static Generator loadFromXML(Element data) {
        Constant constant = new Constant();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("value")) {
                constant.setValue(Double.parseDouble(node.getTextString()));
            }
        }

        return constant;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = new Element("generator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement("value").setText(Double.toString(value));

        return retVal;
    }

    public void setValue(double value) {
        this.value = value;
    }

    public double getValue() {
        return this.value;
    }

    @Override
    public void initialize(double duration) {

    }

    @Override
    public double getValue(double time, java.util.Random rnd) {
        return value;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public Constant deepCopy() {
        return new Constant(this);
    }
}
