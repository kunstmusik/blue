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

//import blue.soundObject.editor.jmask.probability.CauchyEditor;
import blue.soundObject.jmask.Table;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

public class Cauchy implements ProbabilityGenerator {

    private double alpha;  // SPREAD

    private double mu; // MEAN

    private boolean alphaTableEnabled = false;

    private boolean muTableEnabled = false;

    private Table alphaTable = new Table();

    private Table muTable = new Table();

    public Cauchy() {
        alpha = 0.1;
        mu = 0.5;

        alphaTable.getPoint(0).setValue(0.1);
        alphaTable.getPoint(1).setValue(0.1);
        muTable.getPoint(0).setValue(0.5);
        muTable.getPoint(1).setValue(0.5);
    }

    public static ProbabilityGenerator loadFromXML(Element data) {
        Cauchy retVal = new Cauchy();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "alpha":
                    retVal.alpha = XMLUtilities.readDouble(node);
                    break;
                case "mu":
                    retVal.mu = XMLUtilities.readDouble(node);
                    break;
                case "alphaTableEnabled":
                    retVal.alphaTableEnabled = XMLUtilities.readBoolean(node);
                    break;
                case "muTableEnabled":
                    retVal.muTableEnabled = XMLUtilities.readBoolean(node);
                    break;
                case "table":
                    String tableId = node.getAttributeValue("tableId");
                    switch (tableId) {
                        case "alphaTable":
                            retVal.alphaTable = Table.loadFromXML(node);
                            break;
                        case "muTable":
                            retVal.muTable = Table.loadFromXML(node);
                            break;
                    }
                    break;
            }
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("probabilityGenerator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeDouble("alpha", alpha));
        retVal.addElement(XMLUtilities.writeDouble("mu", mu));
        retVal.addElement(XMLUtilities.writeBoolean("alphaTableEnabled", alphaTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("muTableEnabled", muTableEnabled));

        Element alphaTableNode = alphaTable.saveAsXML();
        alphaTableNode.setAttribute("tableId", "alphaTable");

        Element muTableNode = muTable.saveAsXML();
        muTableNode.setAttribute("tableId", "muTable");

        retVal.addElement(alphaTableNode);
        retVal.addElement(muTableNode);

        return retVal;
    }

//    public JComponent getEditor() {
//        return new CauchyEditor(this);
//    }

    public String getName() {
        return "Cauchy";
    }

    public double getValue(double time, java.util.Random rnd) {
        // alpha -> Bereich f�r 50% aller x

        double localAlpha, localMu;

        if (alphaTableEnabled) {
            localAlpha = alphaTable.getValue(time);
        } else {
            localAlpha = alpha;
        }

        if (muTableEnabled) {
            localMu = muTable.getValue(time);
        } else {
            localMu = mu;
        }

        double x, e;
        do // 318*alpha -> 99.9% aller x
        {
            do {
                // mu -> Mittelwert
                x = rnd.nextDouble();
            } while (x == 0.5);
            e = localAlpha * Math.tan(x * Math.PI) + localMu;
        } while ((e > 1.0) || (e < 0.0));

        return e;
    }

    public double getAlpha() {
        return alpha;
    }

    public void setAlpha(double alpha) {
        this.alpha = alpha;
    }

    public double getMu() {
        return mu;
    }

    public void setMu(double mu) {
        this.mu = mu;
    }

    public boolean isAlphaTableEnabled() {
        return alphaTableEnabled;
    }

    public void setAlphaTableEnabled(boolean alphaTableEnabled) {
        this.alphaTableEnabled = alphaTableEnabled;
    }

    public boolean isMuTableEnabled() {
        return muTableEnabled;
    }

    public void setMuTableEnabled(boolean muTableEnabled) {
        this.muTableEnabled = muTableEnabled;
    }

    public Table getAlphaTable() {
        return alphaTable;
    }

    public void setAlphaTable(Table alphaTable) {
        this.alphaTable = alphaTable;
    }

    public Table getMuTable() {
        return muTable;
    }

    public void setMuTable(Table muTable) {
        this.muTable = muTable;
    }
}
