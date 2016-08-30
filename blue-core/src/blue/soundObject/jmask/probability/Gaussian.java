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

public class Gaussian implements ProbabilityGenerator {

    private double sigma;

    private double mu;

    private boolean sigmaTableEnabled = false;

    private boolean muTableEnabled = false;

    private Table sigmaTable = new Table();

    private Table muTable = new Table();

    public Gaussian() {
        sigma = 0.1;
        mu = 0.5;

        sigmaTable.getPoint(0).setValue(0.1);
        sigmaTable.getPoint(1).setValue(0.1);
        muTable.getPoint(0).setValue(0.5);
        muTable.getPoint(1).setValue(0.5);
    }

    public static ProbabilityGenerator loadFromXML(Element data) {
        Gaussian retVal = new Gaussian();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "sigma":
                    retVal.sigma = XMLUtilities.readDouble(node);
                    break;
                case "mu":
                    retVal.mu  = XMLUtilities.readDouble(node);
                    break;
                case "sigmaTableEnabled":
                    retVal.sigmaTableEnabled = XMLUtilities.readBoolean(node);
                    break;
                case "muTableEnabled":
                    retVal.muTableEnabled = XMLUtilities.readBoolean(node);
                    break;
                case "table":
                    String tableId = node.getAttributeValue("tableId");
                    switch (tableId) {
                        case "sigmaTable":
                            retVal.sigmaTable = Table.loadFromXML(node);
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

    @Override
    public Element saveAsXML() {
        Element retVal = new Element("probabilityGenerator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeDouble("sigma", sigma));
        retVal.addElement(XMLUtilities.writeDouble("mu", mu));
        retVal.addElement(XMLUtilities.writeBoolean("sigmaTableEnabled", sigmaTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("muTableEnabled", muTableEnabled));

        Element sigmaTableNode = sigmaTable.saveAsXML();
        sigmaTableNode.setAttribute("tableId", "sigmaTable");

        Element muTableNode = muTable.saveAsXML();
        muTableNode.setAttribute("tableId", "muTable");

        retVal.addElement(sigmaTableNode);
        retVal.addElement(muTableNode);

        return retVal;
    }

//    public JComponent getEditor() {
//        return new GaussianEditor(this);
//    }

    @Override
    public String getName() {
        return "Gaussian";
    }

    @Override
    public double getValue(double time, java.util.Random rnd) {
        // sigma = Standardabweichung
        // mu = Mittelwert
        // mu+-sigma -> 68.26% aller x
        double e, sum;
        
        double localSigma, localMu;

        if (sigmaTableEnabled) {
            localSigma = sigmaTable.getValue(time);
        } else {
            localSigma = sigma;
        }

        if (muTableEnabled) {
            localMu = muTable.getValue(time);
        } else {
            localMu = mu;
        }

        do {
            sum = 0;
            for (int i = 1; i <= 12; i++) {
                sum += rnd.nextDouble();
            }
            e = localSigma * (sum - 6.0) + localMu;
        } while ((e > 1.0) || (e < 0.0));

        return e;
    }

    public double getSigma() {
        return sigma;
    }

    public void setSigma(double sigma) {
        this.sigma = sigma;
    }

    public double getMu() {
        return mu;
    }

    public void setMu(double mu) {
        this.mu = mu;
    }

    public boolean isSigmaTableEnabled() {
        return sigmaTableEnabled;
    }

    public void setSigmaTableEnabled(boolean sigmaTableEnabled) {
        this.sigmaTableEnabled = sigmaTableEnabled;
    }

    public boolean isMuTableEnabled() {
        return muTableEnabled;
    }

    public void setMuTableEnabled(boolean muTableEnabled) {
        this.muTableEnabled = muTableEnabled;
    }

    public Table getSigmaTable() {
        return sigmaTable;
    }

    public void setSigmaTable(Table sigmaTable) {
        this.sigmaTable = sigmaTable;
    }

    public Table getMuTable() {
        return muTable;
    }

    public void setMuTable(Table muTable) {
        this.muTable = muTable;
    }
}
