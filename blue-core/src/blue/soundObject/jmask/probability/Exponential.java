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

//import blue.soundObject.editor.jmask.probability.ExponentialEditor;
import blue.soundObject.jmask.Table;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

public class Exponential implements ProbabilityGenerator {

    public static final int DECREASING = 0;

    public static final int INCREASING = 1;

    public static final int BILATERAL = 2;

    private int direction = DECREASING;

    private double lambda = 0.5;
    
    private Table lambdaTable = new Table();
    
    private boolean lambdaTableEnabled = false;
    
    public Exponential() {
        lambdaTable.setMin(.0001, false);
    }

    public static ProbabilityGenerator loadFromXML(Element data) {
        Exponential retVal = new Exponential();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "direction":
                    retVal.direction = XMLUtilities.readInt(node);
                    break;
                case "lambda":
                    retVal.lambda = XMLUtilities.readDouble(node);
                    break;
                case "lambdaTableEnabled":
                    retVal.lambdaTableEnabled = XMLUtilities.readBoolean(node);
                    break; 
                case "table":
                    retVal.lambdaTable = Table.loadFromXML(node);
                    break;
            }
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("probabilityGenerator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeInt("direction", direction));
        retVal.addElement(XMLUtilities.writeDouble("lambda", lambda));
        retVal.addElement(XMLUtilities.writeBoolean("lambdaTableEnabled", 
                lambdaTableEnabled));
        retVal.addElement(lambdaTable.saveAsXML());

        return retVal;
    }

//    public JComponent getEditor() {
//        return new ExponentialEditor(this);
//    }

    public String getName() {
        return "Exponential";
    }

    public double getValue(double time) {
        double x;
        double localLambda;
        
        if(lambdaTableEnabled) {
            localLambda = lambdaTable.getValue(time);
        } else {
            localLambda = lambda;
        }
        
        if (direction == BILATERAL) {
            double e;
            do {
                x = 2.0 * Math.random();
                if (x > 1.0) {
                    x = 2.0 - x;
                    e = -Math.log(x);
                } else
                    e = Math.log(x);
                e = (e / 14.0 / localLambda) + 0.5;
            } while ((e > 1.0) || (e < 0.0));

            x = e;
        } else {
            do {
                while ((x = Math.random()) == 0) {
                }
                x = -Math.log(x) / 7.0 / localLambda;
            } while (x > 1.0);

            if (direction == INCREASING) {
                x = 1.0 - x;
            }

        }

        return x;
    }

    public int getDirection() {
        return direction;
    }

    public void setDirection(int direction) {
        this.direction = direction;
    }

    public double getLambda() {
        return lambda;
    }

    public void setLambda(double lambda) {
        this.lambda = lambda;
    }

    public Table getLambdaTable() {
        return lambdaTable;
    }

    public void setLambdaTable(Table lambdaTable) {
        this.lambdaTable = lambdaTable;
    }

    public boolean isLambdaTableEnabled() {
        return lambdaTableEnabled;
    }

    public void setLambdaTableEnabled(boolean lambdaTableEnabled) {
        this.lambdaTableEnabled = lambdaTableEnabled;
    }

}
