/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.jmask.probability;

import blue.soundObject.jmask.Table;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

public class Weibull implements ProbabilityGenerator {

    private double s; // s -> horizontale Dehnung

    private double t; // t -> shape

    private boolean sTableEnabled = false;

    private boolean tTableEnabled = false;

    private Table sTable; 

    private Table tTable;

    public Weibull() {
        s = 0.5;
        t = 2.0;

        sTable = new Table();
        tTable = new Table();

        tTable.setMax(4.0, false);
        tTable.setMin(0.001, false);

        sTable.getPoint(0).setValue(0.5);
        sTable.getPoint(1).setValue(0.5);
        tTable.getPoint(0).setValue(2.0);
        tTable.getPoint(1).setValue(2.0);
    }

    public Weibull(Weibull wb) {
        s = wb.s;
        t = wb.t;
        sTableEnabled = wb.sTableEnabled;
        tTableEnabled = wb.tTableEnabled;
        sTable = new Table(wb.sTable);
        tTable = new Table(wb.tTable);
    }

    public static ProbabilityGenerator loadFromXML(Element data) {
        Weibull retVal = new Weibull();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "s":
                    retVal.s = XMLUtilities.readDouble(node);
                    break;
                case "t":
                    retVal.t = XMLUtilities.readDouble(node);
                    break;
                case "sTableEnabled":
                    retVal.sTableEnabled = XMLUtilities.readBoolean(node);
                    break;
                case "tTableEnabled":
                    retVal.tTableEnabled = XMLUtilities.readBoolean(node);
                    break;
                case "table":
                    String tableId = node.getAttributeValue("tableId");
                    switch (tableId) {
                        case "sTable":
                            retVal.sTable = Table.loadFromXML(node);
                            break;
                        case "tTable":
                            retVal.tTable = Table.loadFromXML(node);
                            break;
                    }
                    break;
            }
        }

        return retVal;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = new Element("probabilityGenerator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeDouble("s", s));
        retVal.addElement(XMLUtilities.writeDouble("t", t));
        retVal.addElement(XMLUtilities.writeBoolean("sTableEnabled", sTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("tTableEnabled", tTableEnabled));

        Element sTableNode = sTable.saveAsXML();
        sTableNode.setAttribute("tableId", "sTable");

        Element tTableNode = tTable.saveAsXML();
        tTableNode.setAttribute("tableId", "tTable");

        retVal.addElement(sTableNode);
        retVal.addElement(tTableNode);

        return retVal;
    }

    @Override
    public String getName() {
        return "Weibull";
    }

    @Override
    public double getValue(double time, java.util.Random rnd) {

        double x, a, e; // t>1 -> max bei s

        double localS, localT;

        if (sTableEnabled) {
            localS = sTable.getValue(time);
        } else {
            localS = s;
        }

        if (tTableEnabled) {
            localT = tTable.getValue(time);
        } else {
            localT = t;
        }

        do {
            x = rnd.nextDouble();
            a = 1.0 / (1.0 - x);
            e = localS * Math.pow(Math.log(a), (1.0 / localT));
        } while (e > 1);

        return e;

    }

    public double getS() {
        return s;
    }

    public void setS(double s) {
        this.s = s;
    }

    public double getT() {
        return t;
    }

    public void setT(double t) {
        this.t = t;
    }

    public boolean isSTableEnabled() {
        return sTableEnabled;
    }

    public void setSTableEnabled(boolean sTableEnabled) {
        this.sTableEnabled = sTableEnabled;
    }

    public boolean isTTableEnabled() {
        return tTableEnabled;
    }

    public void setTTableEnabled(boolean tTableEnabled) {
        this.tTableEnabled = tTableEnabled;
    }

    public Table getSTable() {
        return sTable;
    }

    public void setSTable(Table sTable) {
        this.sTable = sTable;
    }

    public Table getTTable() {
        return tTable;
    }

    public void setTTable(Table tTable) {
        this.tTable = tTable;
    }

    @Override
    public Weibull deepCopy() {
        return new Weibull(this);
    }
}
