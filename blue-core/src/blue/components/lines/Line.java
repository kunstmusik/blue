/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.components.lines;

import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
import java.io.*;
import java.rmi.dgc.VMID;
import java.util.*;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.text.StrBuilder;

/**
 * This Line class is used in a number of places in blue. For situations like
 * the BSB/ObjectBuilder LineObject or the LineObject SoundObject, the values of
 * points are closed on both ends with a minimum of two points required for use
 * at x values 0.0 and 1.0. For non-rightbound lines such as Automations, x
 * values are set to any positive value or 0.
 * 
 * Previous to 0.110.0, y values were always held internally to be in 0.0-1.0
 * range, and when their values were retrieved for compilation, they were scaled
 * by the min and max values set on the line.
 * 
 * After 0.110.0, y values are set to the their full values between min and max.
 * 
 * @author Steven
 */
public class Line implements TableModel, Serializable, ChangeListener {
    String varName = "";

    float max = 1.0f;

    float min = 0.0f;

    float resolution = -1.0f;

    Color color = null;

    boolean isZak = false;

    boolean rightBound = false;

    protected int channel = 1;

    protected String uniqueID = "";
    
    private boolean endPointsLinked = false;

    ArrayList<LinePoint> points = new ArrayList<LinePoint>();

    transient Vector<TableModelListener> listeners = null;

    /** Defaults to right bound and with default points */
    public Line() {
        this(true);
    }

    /** For use to make lines not right bound */
    public Line(boolean rightBound) {
        this(rightBound, true);
    }

    private Line(boolean rightBound, boolean init) {
        if (init) {
            LinePoint point1 = new LinePoint();
            point1.setLocation(0.0f, 0.5f);

            points.add(point1);

            if (rightBound) {
                LinePoint point2 = new LinePoint();
                point2.setLocation(1.0f, 0.5f);

                points.add(point2);
            }
        }

        this.rightBound = rightBound;
        this.color = new Color(128, 128, 128);

        uniqueID = Integer.toString(new VMID().hashCode());
    }

    public static Line loadFromXML(Element data) {
        Line line = new Line(false, false);

        if (data.getName().equals("line")) {
            line.varName = data.getAttributeValue("name");
            line.setZak(false);
        } else if (data.getName().equals("zakline")) {
            line.channel = Integer.parseInt(data.getAttributeValue("channel"));
            line.setZak(true);
        }

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

        line.max = Float.parseFloat(data.getAttributeValue("max"));
        line.min = Float.parseFloat(data.getAttributeValue("min"));

        if (data.getAttributeValue("resolution") != null) {
            line.resolution = Float.parseFloat(data
                    .getAttributeValue("resolution"));
        }

        String colorStr = data.getAttributeValue("color");

        if (colorStr != null && colorStr.length() > 0) {
            line.color = new Color(Integer.parseInt(colorStr));
        } else {
            // some older project files may not have a color associated with
            // their Line objects. However, a color IS required in the
            // LineCanvas
            // implementation, so we makeup a color.
            line.color = new Color(128, 128, 128);
        }

        String rBound = data.getAttributeValue("rightBound");

        if (rBound != null && rBound.length() > 0) {
            line.rightBound = Boolean.valueOf(rBound).booleanValue();
        }

        String endLinked = data.getAttributeValue("endPointsLinked");

        if (endLinked != null && endLinked.length() > 0) {
            line.endPointsLinked = Boolean.valueOf(endLinked).booleanValue();
        }
        
        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            LinePoint lp = LinePoint.loadFromXML(node);
            line.addLinePoint(lp);

            if (version == 1) {
                lp.setLocation(lp.getX(), migrateYValue(lp.getY(), line.max,
                        line.min));
            }
        }

        return line;
    }

    public Element saveAsXML() {
        Element retVal = null;

        if (isZak) {
            retVal = new Element("zakline");
            retVal.setAttribute("channel", Integer.toString(this.channel));
        } else {
            retVal = new Element("line");
            retVal.setAttribute("name", this.varName);
        }
        retVal.setAttribute("version", "2");
        retVal.setAttribute("max", Float.toString(max));
        retVal.setAttribute("min", Float.toString(min));
        retVal.setAttribute("resolution", Float.toString(resolution));
        retVal.setAttribute("color", Integer.toString(color.getRGB()));
        retVal.setAttribute("rightBound", Boolean.toString(rightBound));
        retVal.setAttribute("endPointsLinked", Boolean.toString(endPointsLinked));

        for (LinePoint point : points) {
            retVal.addElement(point.saveAsXML());
        }

        return retVal;
    }

    public String getVarName() {
        return varName;
    }

    public void setVarName(String varName) {
        this.varName = varName;
    }

    /**
     * Gets the zak channel for this line, if any
     */
    public int getChannel() {
        return channel;
    }

    /**
     * Sets the zak channel for this line, if any
     */
    public void setChannel(int channel) {
        this.channel = channel;
    }

    /**
     * Unique identifier used for storing/retrieving associated f-tables
     */
    public String getUniqueID() {
        return uniqueID;
    }

    /**
     * Sets flag indicating whether this Line is for zak
     */
    public void setZak(boolean isZak) {
        this.isZak = isZak;
    }

    /**
     * Returns whether this Line is for zak
     */
    public boolean isZak() {
        return isZak;
    }

    /**
     * @return Returns the max.
     */
    public float getMax() {
        return max;
    }

    /**
     * @param max
     *            The max to set.
     */
    public void setMax(float max, boolean truncate) {
        float oldMax = this.max;
        this.max = max;

        for (LinePoint point : points) {
            
            float newVal;

            if (truncate) {
                newVal = LineUtils.truncate(point.getY(), this.min, this.max);
            } else {
                newVal = LineUtils.rescale(point.getY(), this.min, oldMax,
                        this.min, this.max, this.resolution);
            }

            point.setLocation(point.getX(), newVal);
        }

        fireTableDataChanged();
    }

    /**
     * @return Returns the min.
     */
    public float getMin() {
        return min;
    }

    /**
     * @param min
     *            The min to set.
     */
    public void setMin(float min, boolean truncate) {
        float oldMin = this.min;
        this.min = min;

        for (LinePoint point : points) {

            float newVal;

            if (truncate) {
                newVal = LineUtils.truncate(point.getY(), this.min, this.max);
            } else {
                newVal = LineUtils.rescale(point.getY(), oldMin, this.max,
                        this.min, this.max, this.resolution);
            }

            point.setLocation(point.getX(), newVal);
        }

        fireTableDataChanged();
    }

    public void setMinMax(float newMin, float newMax, boolean truncate) {
        
        if(this.min == newMin && this.max == newMax) {
            return;
        }
        
        for (LinePoint point : points) {
            
            float newVal;

            if (truncate) {
                newVal = LineUtils.truncate(point.getY(), newMin, newMax);
            } else {
                newVal = LineUtils.rescale(point.getY(), this.min, this.max,
                        newMin, newMax, this.resolution);
            }

            point.setLocation(point.getX(), newVal);
        }
        
        this.min = newMin;
        this.max = newMax;
        
        fireTableDataChanged();
    }
    
    public Iterator getPointsIterator() {
        return points.iterator();
    }
    
    public Color getColor() {
        return color;
    }

    public void setColor(Color color) {
        this.color = color;

        // This is somewhat of a heavy way to do notify to repaint line but
        // is not in a high performance situation so is alright
        fireTableDataChanged();
    }

    // public float getYValue(LinePoint p) {
    // float range = max - min;
    //
    // return ((p.getY() * range) + min);
    // }

    // METHODS FOR LIST OPERATIONS

    public LinePoint getLinePoint(int index) {
        return points.get(index);
    }

    public void addLinePoint(LinePoint linePoint) {
        points.add(linePoint);
        linePoint.addChangeListener(this);

        int end = points.size() - 1;

        fireTableRowsInserted(end, end);
    }

    public void addLinePoint(int index, LinePoint linePoint) {
        points.add(index, linePoint);
        linePoint.addChangeListener(this);

        fireTableRowsInserted(index, index);
    }

    public void insertLinePoint(LinePoint lp) {
        for (int i = 0; i < points.size(); i++) {
            LinePoint temp = points.get(i);

            if (temp.getX() > lp.getX()) {
                addLinePoint(i, lp);
                return;
            }
        }
        addLinePoint(lp);
    }

    public void removeLinePoint(int index) {
        LinePoint linePoint = points.remove(index);
        linePoint.removeChangeListener(this);

        fireTableRowsDeleted(index, index);
    }

    public void removeLinePoint(LinePoint linePoint) {
        int index = points.indexOf(linePoint);
        if (index >= 0) {
            points.remove(linePoint);
            linePoint.removeChangeListener(this);

            fireTableRowsDeleted(index, index);
        }
    }

    public int size() {
        return points.size();
    }

    public void clear() {
        points.clear();
        fireTableDataChanged();
    }

    // TABLE MODEL METHODS

    public int getColumnCount() {
        return 2;
    }

    public int getRowCount() {
        return points.size();
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        if (rowIndex == 0 && columnIndex == 0) {
            return false;
        } else if (rowIndex == (size() - 1) && columnIndex == 0) {
            return false;
        }

        return true;
    }

    public Class getColumnClass(int columnIndex) {
        return Float.class;
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        LinePoint p = points.get(rowIndex);

        if (columnIndex == 0) {
            return new Float(p.getX());
        }

        return new Float(p.getY());
    }

    /*
     * Only to be used for migration from pre-0.110.0 files, converts 0-1.0
     * range values to absolute values
     */
    private static float migrateYValue(float y, float max, float min) {
        float range = max - min;
        float yVal = (y * range) + min;

        return yVal;
    }

    // private float convertYValue(float y) {
    // float range = getMax() - getMin();
    // float yVal = (y - getMin()) / range;
    //
    // if(yVal < getMin()) {
    // yVal = getMin();
    // }
    //
    // if(yVal > getMax()) {
    // yVal = getMax();
    // }
    //
    //
    // return yVal;
    // }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        Float val = (Float) aValue;
        float newValue = val.floatValue();

        LinePoint point = getLinePoint(rowIndex);

        boolean isLeft = (rowIndex == 0);
        boolean isRight = (rowIndex == (size() - 1));

        LinePoint previous = isLeft ? null : getLinePoint(rowIndex - 1);
        LinePoint next = isRight ? null : getLinePoint(rowIndex + 1);

        if (columnIndex == 0) {

            if (isLeft) {
                return;
            }

            if (rightBound && isRight) {
                return;
            }

            if (newValue < previous.getX()) {
                newValue = previous.getX();
            }

            if (rightBound && newValue > next.getX()) {
                newValue = next.getX();
            }

            float y = point.getY();
            point.setLocation(newValue, y);
        } else {
            if (newValue < getMin() || newValue > getMax()) {
                return;
            }

            float x = point.getX();
            point.setLocation(x, newValue);
        }

        fireTableCellUpdated(rowIndex, columnIndex);
    }

    public String getColumnName(int columnIndex) {
        return (columnIndex == 0) ? "x" : "y";
    }

    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector<TableModelListener>();
        }

        if(!listeners.contains(l)) {
            listeners.add(l);
        }
    }

    public void removeTableModelListener(TableModelListener l) {
        if (listeners != null) {
            listeners.remove(l);
        }
    }

    public void fireTableDataChanged() {
        fireTableChanged(new TableModelEvent(this));
    }

    public void fireTableRowsInserted(int firstRow, int lastRow) {
        fireTableChanged(new TableModelEvent(this, firstRow, lastRow,
                TableModelEvent.ALL_COLUMNS, TableModelEvent.INSERT));
    }

    public void fireTableRowsUpdated(int firstRow, int lastRow) {
        fireTableChanged(new TableModelEvent(this, firstRow, lastRow,
                TableModelEvent.ALL_COLUMNS, TableModelEvent.UPDATE));
    }

    public void fireTableRowsDeleted(int firstRow, int lastRow) {
        fireTableChanged(new TableModelEvent(this, firstRow, lastRow,
                TableModelEvent.ALL_COLUMNS, TableModelEvent.DELETE));
    }

    public void fireTableCellUpdated(int row, int column) {
        fireTableChanged(new TableModelEvent(this, row, row, column));
    }

    public void fireTableChanged(TableModelEvent e) {
        if (listeners != null) {
            for (Iterator iter = listeners.iterator(); iter.hasNext();) {
                TableModelListener listener = (TableModelListener) iter.next();
                listener.tableChanged(e);
            }
        }
    }

    public void stateChanged(ChangeEvent e) {
        LinePoint lp = (LinePoint) e.getSource();

        int index = points.indexOf(lp);

        if (index >= 0) {
            fireTableRowsUpdated(index, index);
        }
    }

    /*
     * This gets called as part of Serialization by Java and will do default
     * serialization plus reconnect this Line as a listener to its LinePoints
     */
    private void readObject(ObjectInputStream stream) throws IOException,
            ClassNotFoundException {
        stream.defaultReadObject();

        for (Iterator iter = points.iterator(); iter.hasNext();) {
            LinePoint lp = (LinePoint) iter.next();
            lp.addChangeListener(this);
        }
    }

    /**
     * Returns value for time given, developed for use in non-bound right
     * Automations. If beyond last point will return value of last point,
     * otherwise calculates the value on the line between the points.
     * 
     * May want to reconsider moving this out to the client class.
     * 
     * Current assumes straight lines between points.
     */

    public float getValue(float time) {

        int size = size();
        if (size == 0) {
            return 0.0f;
        }

        LinePoint a = getLinePoint(0);

        if (size == 1 || time == 0.0f) {
            return a.getY(); // assumes left bound to 0
        }

        LinePoint b = null;

        for (int i = 1; i < size; i++) {
            b = getLinePoint(i);

            if (b.getX() == time) {
                if (i == (size - 1)) {
                    return b.getY();
                }

                while (i < size) {
                    LinePoint temp = getLinePoint(i);

                    if (temp.getX() != time) {
                        break;
                    }
                    b = temp;
                    i++;
                }

                return b.getY();
            }

            if (b.getX() < time) {
                a = b;
            } else {
                break;
            }
        }

        if (b == a) {
            return b.getY();
        }

        float m = (b.getY() - a.getY()) / (b.getX() - a.getX());
        float x = (time - a.getX());

        float y = (m * x) + a.getY();

        return y;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public boolean isRightBound() {
        return rightBound;
    }  
    
    public float getResolution() {
        return resolution;
    }

    public void setResolution(float resolution) {
        this.resolution = resolution;
        for (Iterator iter = points.iterator(); iter.hasNext();) {
            LinePoint point = (LinePoint) iter.next();

            float newVal = LineUtils.snapToResolution(point.getY(), this.min,
                    this.max, this.resolution);

            point.setLocation(point.getX(), newVal);
        }
    }

    public boolean isEndPointsLinked() {
        return endPointsLinked;
    }

    public void setEndPointsLinked(boolean endPointsLinked) {
        this.endPointsLinked = endPointsLinked;
    }    
    
    /**
     * Export line data values as BPF format
     * 
     * @return
     */
    public String exportBPF() {

        if (points.size() == 0) {
            return null;
        }

        StrBuilder builder = new StrBuilder();

        for (Iterator iter = points.iterator(); iter.hasNext();) {
            LinePoint point = (LinePoint) iter.next();

            builder.append(point.getX()).append("\t").append(point.getY())
                    .append("\n");
        }

        return builder.toString();
    }

    public boolean importBPF(File bpfFile) {
        String text = null;
        try {
            text = TextUtilities.getTextFromFile(bpfFile);
        } catch (FileNotFoundException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (text == null) {
            return false;
        }

        ArrayList temp = new ArrayList();

        StringTokenizer lines = new StringTokenizer(text, "\n");

        while (lines.hasMoreTokens()) {
            String line = lines.nextToken();

            if (line.trim().length() == 0) {
                continue;
            }

            String[] parts = line.split("\\s+");

            if (parts.length != 2) {
                System.err.println("parts length = " + parts.length);
                return false;
            }

            LinePoint lp = new LinePoint();
            lp.setLocation(Float.parseFloat(parts[0]), Float
                    .parseFloat(parts[1]));

            temp.add(lp);
        }

        // Collections.sort(temp);

        this.points = temp;

        fireTableDataChanged();

        return true;
    }

    
    public void sort() {
        Collections.sort(points);
    }
    
    public boolean isFirstLinePoint(LinePoint linePoint) {
        if(points == null || points.size() == 0) {
            return false;
        }
        
        return linePoint == points.get(0);
    }
}