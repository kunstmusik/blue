/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

public class Segment implements Generator, Quantizable, Accumulatable {

    Table table = new Table();

    public Segment() {
    }

    public Segment(Segment seg) {
        table = new Table(seg.table);
    }

    public static Generator loadFromXML(Element data) {
        Segment retVal = new Segment();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("table")) {
                retVal.table = Table.loadFromXML(node);
            }
        }

        return retVal;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = new Element("generator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(table.saveAsXML());
        return retVal;
    }

    @Override
    public void initialize(double duration) {
        for (int i = 0; i < table.getRowCount(); i++) {
            TablePoint tp = table.getTablePoint(i);
            tp.setTime(tp.getTime() * duration);
        }
    }

    @Override
    public double getValue(double time, java.util.Random rnd) {
        return table.getValue(time);
    }

    public Table getTable() {
        return table;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public Segment deepCopy() {
        return new Segment(this);
    }
}
