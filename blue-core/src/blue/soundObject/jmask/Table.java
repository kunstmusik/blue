/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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

import blue.components.lines.LineUtils;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.event.TableModelListener;
import javax.swing.table.AbstractTableModel;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Table extends AbstractTableModel implements Serializable {

    public static final int OFF = 0;

    public static final int ON = 1;

    public static final int COS = 2;

    public static final String[] TYPES = {"Off", "On", "Cosine"};

    ArrayList<TablePoint> points = new ArrayList<TablePoint>();

    private double min = 0.0;

    private double max = 1.0;

    private int interpolationType = ON;

    double interpolation = 0.0;

    transient PropertyChangeSupport propChangeSupport = null;

    public Table() {
        this(true);
    }

    private Table(boolean init) {
        if (init) {
            TablePoint tablePoint1 = new TablePoint();
            TablePoint tablePoint2 = new TablePoint();

            tablePoint2.setTime(1.0);

            points.add(tablePoint1);
            points.add(tablePoint2);
        }
    }

    public double getValue(double time) {
        int size = points.size();
        if (size == 0) {
            return 0.0;
        }

        TablePoint a = getPoint(0);

        if (size == 1 || time <= 0.0) {
            return a.getValue(); // assumes left bound to 0
        }

        TablePoint b = null;

        for (int i = 1; i < size; i++) {
            b = getPoint(i);

            if (b.getTime() == time) {
                if (i == (size - 1)) {
                    return b.getValue();
                }

                while (i < size) {
                    TablePoint temp = getPoint(i);

                    if (temp.getTime() != time) {
                        break;
                    }
                    b = temp;
                    i++;
                }

                return b.getValue();
            }

            if (b.getTime() < time) {
                a = b;
            } else {
                break;
            }
        }

        if (b == a) {
            return b.getValue();
        }

        double r = (time - a.getTime()) / (b.getTime() - a.getTime());

        double retVal = 0.0;
        
        switch (this.getInterpolationType()) {
            case OFF:
                retVal = a.getValue();
                break;
            case ON:
                retVal = interpolate(this.interpolation, r, a.getValue(), b.getValue());
                break;
            case COS:
                retVal = interpolateCosine(r, a.getValue(), b.getValue());
                break;
        }

        return retVal;
    }
    
    double getphs(double xt) {			//Phasenzeiger an der Stelle xt
	double erg,f,xtr,phsum;
	
	phsum = 0.0;
        xtr = Utilities.round(xt, 10);
        
        int pointsSize = points.size();
        
        double[] x = new double[pointsSize];
        double[] y = new double[pointsSize];
        
        for(int i = 0; i < pointsSize; i++) {
            TablePoint tp = (TablePoint) points.get(i);
            x[i] = tp.getTime();
            y[i] = tp.getValue();
        }
        
        if (pointsSize == 0) {
            erg = 0.0;
        } else if (pointsSize == 1) {
            erg = xtr * y[0];
        } else if (xtr <= x[0]) {
            erg = x[0] * y[0] - xtr * y[0];
        } //else if(xtr > x[N-1]) 	erg = x[y[N-1];
        else {
            int i = 0;
            while((i < pointsSize) && (x[i] < xtr)) {
                i++;
            }			//Suche nach 1. x-Tabelleneintrag gr..ergleich xt
            if (interpolationType != OFF) {
                if (i >= 2) {
                    for (int k = 0; k < (i - 1); k++) {
                        phsum += integrate(x[k + 1] - x[k], x[k + 1] - x[k], y[k], y[k + 1]);
                    }
                } //Integration aller kompletten Segmente
                if (xtr >= x[pointsSize - 1]) {
                    phsum += xtr * y[pointsSize - 1] - x[pointsSize - 1] * y[pointsSize - 1];
                } else {
                    //f = (xtr - x[i-1]) / (x[i] - x[i-1]);	//Prozent des Zeitintervalls an der Stelle xt
                    //erg = interpol(iplval,f,y[i-1], y[i]);	//Interpolation des Wertes an Stelle xt
                    phsum += integrate(xtr - x[i - 1], x[i] - x[i - 1], y[i - 1], y[i]);
                //cout << f << "  " << erg << endl;
                }
                erg = phsum;
            } else {
                if (i >= 2) {
                    for (int k = 0; k < (i - 1); k++) {
                        phsum += x[k + 1] * y[k] - x[k] * y[k];
                    }
                } //Integration aller Stufen-Segmente
                phsum += xtr * y[i - 1] - x[i - 1] * y[i - 1];
                erg = phsum;
            }
        }
        return erg;
    }

    private double integrate(double x1, double xe, double y1, double y2) {
        // bestimmtes Integral zwischen 0 und x1 for y1+(y2-y1)*(x^pw2)/(xe^pw2)

        double pw2 = Math.pow(2, interpolation);

        double retVal = x1 * y1 + Math.pow(x1, 1.0 + pw2) * (y2 - y1) / ((1.0 + pw2) * Math.pow(xe, pw2));

        return retVal;

    }

    private double interpolate(double ex, double r, double a, double b) {
        double retVal = 0.0;

        if (ex == 0.0) {
            retVal = a + r * (b - a);
        } else if ((ex > 0.0) && (b >= a)) {
            retVal = a + Math.pow(r, ex + 1.0) * (b - a);
        } else if ((ex > 0.0) && (b < a)) {
            retVal = b + Math.pow(1.0 - r, ex + 1.0) * (a - b);
        } else if ((ex < 0.0) && (b >= a)) {
            retVal = b + Math.pow(1.0 - r, Math.abs(ex) + 1.0) * (a - b);
        } else if ((ex < 0.0) && (b < a)) {
            retVal = a + Math.pow(r, Math.abs(ex) + 1.0) * (b - a);
        }

        return retVal;
    }

    double interpolateCosine(double r, double a, double b) {
        double erg, cx;

        cx = Math.cos(Math.PI * r + Math.PI) / 2.0 + 0.5;
        erg = a + cx * (b - a);
        return erg;
    }

    public TablePoint getPoint(int index) {
        return (TablePoint) points.get(index);
    }

    public void addPoint(int index, TablePoint point) {
        points.add(index, point);
        fireTableRowsInserted(index, index);
    }

    public void removePoint(int index) {
        points.remove(index);

        fireTableRowsDeleted(index, index);
    }

    public void removePoint(TablePoint selectedPoint) {
        removePoint(points.indexOf(selectedPoint));
    }

    public Class getColumnClass(int columnIndex) {
        return Double.class;
    }

    public int getColumnCount() {
        return 2;
    }

    public String getColumnName(int columnIndex) {
        if (columnIndex == 0) {
            return "Time";
        }
        return "Value";
    }

    public int getRowCount() {
        return points.size();
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        TablePoint tp = getPoint(rowIndex);

        if (columnIndex == 0) {
            return new Double(tp.getTime());
        }

        return new Double(tp.getValue());
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if (!(aValue instanceof Double)) {
            return;
        }

        double val = ((Double) aValue).doubleValue();

        TablePoint tp = getPoint(rowIndex);

        if (columnIndex == 0) {
            boolean isLeft = (rowIndex == 0);
            boolean isRight = (rowIndex == (points.size() - 1));

            TablePoint previous = isLeft ? null : getPoint(rowIndex - 1);
            TablePoint next = isRight ? null : getPoint(rowIndex + 1);

            if (isLeft) {
                return;
            }

            if (isRight) {
                return;
            }

            if (val < previous.getTime()) {
                val = previous.getTime();
            }

            if (val > next.getTime()) {
                val = next.getTime();
            }

            tp.setTime(val);
            fireTableCellUpdated(rowIndex, columnIndex);
        } else {
            tp.setValue(val);
            fireTableCellUpdated(rowIndex, columnIndex);
        }

    }

    public double getInterpolation() {
        return interpolation;
    }

    public void setInterpolation(double interpolation) {

        if (interpolation == this.interpolation) {
            return;
        }

        double oldVal = this.interpolation;

        this.interpolation = interpolation;

        if (propChangeSupport != null) {
            propChangeSupport.firePropertyChange("interpolation",
                    new Double(oldVal), new Double(interpolation));
        }
    }

    public static Table loadFromXML(Element data) {
        Table retVal = new Table(false);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("min")) {
                retVal.min = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("max")) {
                retVal.max = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("interpolationType")) {
                retVal.setInterpolationType(Integer.parseInt(node.getTextString()));
            } else if (nodeName.equals("interpolation")) {
                retVal.interpolation = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("points")) {
                Elements pointNodes = node.getElements();

                while (pointNodes.hasMoreElements()) {
                    Element pointNode = pointNodes.next();
                    String pointNodeName = pointNode.getName();

                    if (pointNodeName.equals("point")) {
                        retVal.points.add(TablePoint.loadFromXML(pointNode));
                    }
                }
            }

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("table");

        retVal.addElement(XMLUtilities.writeDouble("min", getMin()));
        retVal.addElement(XMLUtilities.writeDouble("max", getMax()));
        retVal.addElement(XMLUtilities.writeInt("interpolationType", getInterpolationType()));
        retVal.addElement(XMLUtilities.writeDouble("interpolation",
                interpolation));

        Element pointsNode = new Element("points");

        for (Iterator it = points.iterator(); it.hasNext();) {
            TablePoint tPoint = (TablePoint) it.next();
            pointsNode.addElement(tPoint.saveAsXML());
        }

        retVal.addElement(pointsNode);

        return retVal;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj, false, this.getClass());
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public double getMin() {
        return min;
    }

    public void setMin(double min, boolean truncate) {
        if(this.min == min) {
            return;
        }
        
        double oldVal = this.min;
        this.min = min;
        
         for (Iterator iter = points.iterator(); iter.hasNext();) {
            TablePoint point = (TablePoint) iter.next();

            double newVal;

            if (truncate) {
                newVal = LineUtils.truncate(point.getValue(), this.min, this.max);
            } else {
                newVal = LineUtils.rescale(point.getValue(), oldVal, this.max,
                        this.min, this.max, -1);
            }

            point.setLocation(point.getTime(), newVal);
        }
        
        if (propChangeSupport != null) {
            propChangeSupport.firePropertyChange("min",
                    new Double(oldVal), new Double(this.min));
        }
    }

    public double getMax() {
        return max;
    }

    public void setMax(double max, boolean truncate) {
        if(this.max == max) {
            return;
        }
        
        double oldVal = this.max;
        this.max = max;
        
        for (Iterator iter = points.iterator(); iter.hasNext();) {
            TablePoint point = (TablePoint) iter.next();

            double newVal;

            if (truncate) {
                newVal = LineUtils.truncate(point.getValue(), this.min, this.max);
            } else {
                newVal = LineUtils.rescale(point.getValue(), this.min, oldVal,
                        this.min, this.max, -1.0f);
            }

            point.setLocation(point.getTime(), newVal);
        }        
        
        if (propChangeSupport != null) {
            propChangeSupport.firePropertyChange("max",
                    new Double(oldVal), new Double(this.max));
        }
        
    }

    public TablePoint getTablePoint(int index) {
        return (TablePoint) points.get(index);
    }

    public int getInterpolationType() {
        return interpolationType;
    }

    public void setInterpolationType(int interpolationType) {

        if (interpolationType == this.interpolationType) {
            return;
        }

        int oldVal = this.interpolationType;

        this.interpolationType = interpolationType;

        if (propChangeSupport != null) {
            propChangeSupport.firePropertyChange("interpolationType",
                    new Double(oldVal), new Double(interpolationType));
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propChangeSupport == null) {
            propChangeSupport = new PropertyChangeSupport(this);
        }

        for(PropertyChangeListener listener : propChangeSupport.getPropertyChangeListeners()) {
            if(pcl == listener) {
                return;
            }
        }
        propChangeSupport.addPropertyChangeListener(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (propChangeSupport != null) {
            propChangeSupport.removePropertyChangeListener(pcl);
        }
    }

    @Override
    public void addTableModelListener(TableModelListener tml) {
        for(TableModelListener listener : this.getTableModelListeners()) {
            if(tml == listener) {
                return;
            }
        }

        super.addTableModelListener(tml);
    }

}
