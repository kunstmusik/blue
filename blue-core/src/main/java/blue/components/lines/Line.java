/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2016 Steven Yi (stevenyi@gmail.com)
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
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.rmi.dgc.VMID;
import java.util.*;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
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
public class Line implements TableModel, ChangeListener, Iterable<LinePoint> {

    protected String varName = "";

    protected double max = 1.0f;

    protected double min = 0.0f;

    protected BigDecimal resolution = new BigDecimal(-1);

    protected Color color = null;

    protected boolean isZak = false;

    protected boolean rightBound = false;

    protected int channel = 1;

    protected String uniqueID = "";

    protected boolean endPointsLinked = false;

    protected ObservableList<LinePoint> points;

    transient Vector<TableModelListener> listeners = null;

    /**
     * Defaults to right bound and with default points
     */
    public Line() {
        this(true);
    }

    /**
     * For use to make lines not right bound
     */
    public Line(boolean rightBound) {
        this(rightBound, true);
    }

    private Line(boolean rightBound, boolean init) {
        points = FXCollections.observableArrayList();
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

    public Line(Line line) {
        varName = line.varName;
        max = line.max;
        min = line.min;
        resolution = line.resolution;

        color = line.color;
        isZak = line.isZak;
        rightBound = line.rightBound;
        channel = line.channel;
        // FIXME - verify uniqueID copy is correct...
        uniqueID = line.uniqueID;
        endPointsLinked = line.endPointsLinked;

        points = FXCollections.observableArrayList();

        for (LinePoint lp : line.points) {
            LinePoint newLp = new LinePoint(lp);
            points.add(newLp);
            newLp.addChangeListener(this);
        }
    }

    public static Line loadFromXML(Element data) {
        Line line = new Line(false, false);
        switch (data.getName()) {
            case "line":
                line.varName = data.getAttributeValue("name");
                line.setZak(false);
                break;
            case "zakline":
                line.channel = Integer.parseInt(data.getAttributeValue("channel"));
                line.setZak(true);
                break;
        }

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

        line.max = Double.parseDouble(data.getAttributeValue("max"));
        line.min = Double.parseDouble(data.getAttributeValue("min"));

        if (data.getAttributeValue("resolution") != null) {
            line.resolution = new BigDecimal(Double.parseDouble(data
                    .getAttributeValue("resolution")))
                    .setScale(5, RoundingMode.HALF_UP)
                    .stripTrailingZeros();
        }
        if (data.getAttributeValue("bdresolution") != null) {
            line.resolution = new BigDecimal(data
                    .getAttributeValue("bdresolution"));
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
        retVal.setAttribute("max", Double.toString(max));
        retVal.setAttribute("min", Double.toString(min));
        retVal.setAttribute("bdresolution", resolution.toString());
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
    public double getMax() {
        return max;
    }

    /**
     * @param max The max to set.
     */
    public void setMax(double max, boolean truncate) {
        double oldMax = this.max;
        this.max = max;

        for (LinePoint point : points) {

            double newVal;

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
    public double getMin() {
        return min;
    }

    /**
     * @param min The min to set.
     */
    public void setMin(double min, boolean truncate) {
        double oldMin = this.min;
        this.min = min;

        for (LinePoint point : points) {

            double newVal;

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

    public void setMinMax(double newMin, double newMax, boolean truncate) {

        if (this.min == newMin && this.max == newMax) {
            return;
        }

        for (LinePoint point : points) {

            double newVal;

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

    @Override
    public Iterator<LinePoint> iterator() {
        return points.iterator();
    }

    public Color getColor() {
        return color;
    }

    public javafx.scene.paint.Color getColorFX() {
        int r = color.getRed();
        int g = color.getGreen();
        int b = color.getBlue();
        int a = color.getAlpha();

        return javafx.scene.paint.Color.rgb(
                r, g, b, a / 255.0);
    }

    public void setColor(Color color) {
        this.color = color;

        // This is somewhat of a heavy way to do notify to repaint line but
        // is not in a high performance situation so is alright
        fireTableDataChanged();
    }

    // public double getYValue(LinePoint p) {
    // double range = max - min;
    //
    // return ((p.getY() * range) + min);
    // }
    // METHODS FOR LIST OPERATIONS
    public LinePoint getLinePoint(int index) {
        return points.get(index);
    }

    /**
     * Finds a line point at a specific time and searches for line points coming
     * from left or right (disambiguates when two points share the same time).
     */
    public LinePoint getLinePoint(double time, boolean fromLeft) {
        if (fromLeft) {
            for (int i = 0; i < points.size(); i++) {
                LinePoint lp = points.get(i);
                if (lp.getX() == time) {
                    return lp;
                } else if (lp.getX() > time) {
                    return null;
                }
            }
        } else {

            for (int i = points.size() - 1; i >= 0; i--) {
                LinePoint lp = points.get(i);
                if (lp.getX() == time) {
                    return lp;
                } else if (lp.getX() < time) {
                    return null;
                }
            }
        }
        return null;
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

    public void insertLinePointLeft(LinePoint lp) {
        for (int i = 0; i < points.size(); i++) {
            LinePoint temp = points.get(i);

            if (temp.getX() >= lp.getX()) {
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
    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public int getRowCount() {
        return points.size();
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        if (rowIndex == 0 && columnIndex == 0) {
            return false;
        } else return !rightBound || rowIndex != (size() - 1) || columnIndex != 0;

    }

    @Override
    public Class getColumnClass(int columnIndex) {
        return Double.class;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        LinePoint p = points.get(rowIndex);

        if (columnIndex == 0) {
            return new Double(p.getX());
        }

        return new Double(p.getY());
    }

    /*
     * Only to be used for migration from pre-0.110.0 files, converts 0-1.0
     * range values to absolute values
     */
    private static double migrateYValue(double y, double max, double min) {
        double range = max - min;
        double yVal = (y * range) + min;

        return yVal;
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        Double val = (Double) aValue;
        double newValue = val.doubleValue();

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

            if (previous != null && newValue < previous.getX()) {
                newValue = previous.getX();
            }

            if (next != null && newValue > next.getX()) {
                newValue = next.getX();
            }

            double y = point.getY();
            point.setLocation(newValue, y);
        } else {
            if (newValue < getMin() || newValue > getMax()) {
                return;
            }

            double x = point.getX();
            point.setLocation(x, newValue);
        }

        fireTableCellUpdated(rowIndex, columnIndex);
    }

    @Override
    public String getColumnName(int columnIndex) {
        return (columnIndex == 0) ? "x" : "y";
    }

    @Override
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector<>();
        }

        if (!listeners.contains(l)) {
            listeners.add(l);
        }
    }

    @Override
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

    @Override
    public void stateChanged(ChangeEvent e) {
        LinePoint lp = (LinePoint) e.getSource();

        int index = points.indexOf(lp);

        if (index >= 0) {
            fireTableRowsUpdated(index, index);
        }
    }

    /**
     * Return value at time, taking into account direction (left or right) to
     * calculate value from.
     *
     * @param time
     * @param fromLeft
     * @return
     */
    public double getValue(double time, boolean fromLeft) {
        // Only matters if multiple points share the same time value, i.e., 
        // there is a discontinuity.  If not, delegate to regular getValue().

        if (fromLeft) {
            for (int i = 0; i < size(); i++) {
                LinePoint p = points.get(i);
                final double x = p.getX();
                if (x == time) {
                    return p.getY();
                } else if (x > time) {
                    break;
                }
            }
        } else {
            for (int i = size() - 1; i <= 0; i--) {
                LinePoint p = points.get(i);
                final double x = p.getX();
                if (x == time) {
                    return p.getY();
                } else if (x < time) {
                    break;
                }
            }
        }

        return getValue(time);
    }

    /**
     * Returns value for time given, developed for use in non-bound right
     * Automations. If beyond last point will return value of last point,
     * otherwise calculates the value on the line between the points.
     *
     * Will adjust value if resolution is used and accounts for line direction.
     */
    public double getValue(double time) {

        final int size = size();
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

        double m = (b.getY() - a.getY()) / (b.getX() - a.getX());
        double x = (time - a.getX());

        double y = (m * x) + a.getY();

        if (resolution.doubleValue() > 0.0) {
            if (b.getY() < a.getY()) {
                y += resolution.doubleValue() * 0.99;
            }
            BigDecimal v = new BigDecimal(y).setScale(resolution.scale(),
                    RoundingMode.FLOOR);
            v = v.subtract(v.remainder(resolution));
            y = v.doubleValue();
        }

        return y;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public boolean isRightBound() {
        return rightBound;
    }

    public BigDecimal getResolution() {
        return resolution;
    }

    public void setResolution(BigDecimal resolution) {
        this.resolution = resolution;
        for (Iterator iter = points.iterator(); iter.hasNext();) {
            LinePoint point = (LinePoint) iter.next();

            double newVal = LineUtils.snapToResolution(point.getY(), this.min,
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
                return false;
            }

            LinePoint lp = new LinePoint();
            lp.setLocation(Double.parseDouble(parts[0]), Double
                    .parseDouble(parts[1]));

            temp.add(lp);
        }

        // Collections.sort(temp);
        this.points.clear();
        this.points.addAll(temp);

        fireTableDataChanged();

        return true;
    }

    public void sort() {
        Collections.sort(points);
    }

    public boolean isFirstLinePoint(LinePoint linePoint) {
        if (points == null || points.size() == 0) {
            return false;
        }

        return linePoint == points.get(0);
    }

    public ObservableList<LinePoint> getObservableList() {
        return points;
    }

    protected void insertOrAdjust(double time, double value, boolean fromLeft) {
        LinePoint left = getLinePoint(time, true);
        LinePoint right = (left == null) ? null : getLinePoint(time, false);

        if (left != null && left != right) {
            if (fromLeft) {
                left.setY(value);
            } else {
                right.setY(value);
            }
        } else {
            LinePoint lp = new LinePoint(time, value);
            if (fromLeft) {
                insertLinePointLeft(lp);
            } else {
                insertLinePoint(lp);
            }
        }
    }

    /**
     * Pre-Selection Selection Post-Selection
     *
     * Decisions: * Do we need a new origin start point? * Do we need a new
     * origin end point? * Do we need a new target start point? * Do we need a
     * new target end point? * Do we need selection begin/end points?
     *
     * TODO - fix for scaling
     *
     */
    public void processLineForSelectionDrag(final double selectionStartTime,
            final double selectionEndTime, final double transTime) {

        // if not translate, don't add any new points or do any processing
        if (transTime == 0) {
            return;
        }

        final boolean leftWards = transTime < 0;
        final double originStartOuterValue = getValue(selectionStartTime, true);
        final double originStartInnerValue = getValue(selectionStartTime, false);
        final double originEndOuterValue = getValue(selectionEndTime, false);
        final double originEndInnerValue = getValue(selectionEndTime, true);
        final double transStartTime = selectionStartTime + transTime;
        final double transEndTime = selectionEndTime + transTime;
        final double transStartOuterVal = getValue(transStartTime, true);
        final double transEndOuterVal = getValue(transEndTime, false);

        boolean intersects = Math.abs(transTime)
                <= (selectionEndTime - selectionStartTime);

//        LinePoint targetStartP =
        ArrayList<LinePoint> points = new ArrayList<>();

        for (Iterator<LinePoint> iter = iterator(); iter.hasNext();) {

            LinePoint lp = iter.next();

            // TODO - check this
            if (isFirstLinePoint(lp)) {
                continue;
            }

            double pointTime = lp.getX();

            // remove points if in original selection time or in new selection time
            // old selection time will be added to points list
            // new selection time will be overwritten with values from points list
            // so remove whatever happens to be there
            if (isPointInSelectionRegion(selectionStartTime, selectionEndTime,
                    pointTime, 0)) {
                points.add(lp);
                iter.remove();
            } else if (isPointInSelectionRegion(selectionStartTime, selectionEndTime,
                    pointTime, transTime)) {
                iter.remove();
            }
        }

        stripOuterPoints(points, selectionStartTime, selectionEndTime);

        for (LinePoint lp : points) {
            lp.setLocation(lp.getX() + transTime, lp.getY());
            addLinePoint(lp);
        }

        this.sort();

        if (intersects) {

            /* Maximum, 5 possible points added when moving left/right and 
              intersecting with origin area
             */
            if (transTime > 0) {
                // Moved right
                if (originStartOuterValue != getValue(transStartTime, true)) {
                    insertOrAdjust(transStartTime, originStartOuterValue, true);
                }

                if (originStartInnerValue != getValue(transStartTime, false)) {
                    insertOrAdjust(transStartTime, originStartInnerValue, false);
                }

                if (originStartOuterValue != getValue(selectionStartTime, true)) {
                    insertOrAdjust(selectionStartTime, originStartOuterValue, true);
                }

                if (transEndOuterVal != getValue(transEndTime, false)) {
                    insertOrAdjust(transEndTime, transEndOuterVal, false);
                }

                if (originEndInnerValue != getValue(transEndTime, true)) {
                    insertOrAdjust(transEndTime, originEndInnerValue, true);
                }

            } else {
                //moved left
                // deal with origin selection area            
                // deal with selection target area new boundaries

                if (transStartOuterVal != getValue(transStartTime, true)) {
                    insertOrAdjust(transStartTime, transStartOuterVal, true);
                }

                if (originStartInnerValue != getValue(transStartTime, false)) {
                    insertOrAdjust(transStartTime, originStartInnerValue, false);
                }

                if (originEndInnerValue != getValue(selectionEndTime, true)) {
                    insertOrAdjust(selectionEndTime, originEndInnerValue, true);
                }

                if (originEndOuterValue != getValue(selectionEndTime, false)) {
                    insertOrAdjust(selectionEndTime, originEndOuterValue, false);
                }

                if (originEndInnerValue != getValue(transEndTime, false)) {
                    insertOrAdjust(transEndTime, originEndInnerValue, false);
                }
            }

        } else {

            if (transTime > 0) {

                // deal with origin selection area            
                if (originEndOuterValue != getValue(selectionEndTime, false)) {
                    insertOrAdjust(selectionEndTime, originEndOuterValue, false);
                }

                if (originStartOuterValue != getValue(selectionEndTime, true)) {
                    insertOrAdjust(selectionEndTime, originStartOuterValue, true);
                }

                if (originStartOuterValue != getValue(selectionStartTime, true)) {
                    insertOrAdjust(selectionStartTime, originStartOuterValue, true);
                }

                // deal with selection target area new boundaries
                if (transStartOuterVal != getValue(transStartTime, true)) {
                    insertOrAdjust(transStartTime, transStartOuterVal, true);
                }

                if (transEndOuterVal != getValue(transEndTime, false)) {
                    insertOrAdjust(transEndTime, transEndOuterVal, false);
                }

                // target
                if (originStartInnerValue != getValue(transStartTime, false)) {
                    insertOrAdjust(transStartTime, originStartInnerValue, false);
                }

                if (originEndInnerValue != getValue(transEndTime, true)) {
                    insertOrAdjust(transEndTime, originEndInnerValue, true);
                }

            } else {
                // deal with selection target area new boundaries
                if (transStartOuterVal != getValue(transStartTime, true)) {
                    insertOrAdjust(transStartTime, transStartOuterVal, true);
                }

                if (transEndOuterVal != getValue(transEndTime, false)) {
                    insertOrAdjust(transEndTime, transEndOuterVal, false);
                }

                if (originStartInnerValue != getValue(transStartTime, false)) {
                    insertOrAdjust(transStartTime, originStartInnerValue, false);
                }

                if (originEndInnerValue != getValue(transEndTime, true)) {
                    insertOrAdjust(transEndTime, originEndInnerValue, true);
                }

                // deal with origin selection area            
                if (originStartOuterValue != getValue(selectionEndTime, true)) {
                    insertOrAdjust(selectionEndTime, originStartOuterValue, true);
                }

                if (originEndOuterValue != getValue(selectionEndTime, false)) {
                    insertOrAdjust(selectionEndTime, originEndOuterValue, false);
                }

                if (originStartOuterValue != getValue(selectionStartTime, true)) {
                    insertOrAdjust(selectionStartTime, originStartOuterValue, true);
                }
            }

        }

        this.sort();
        stripTimeDeadPoints();
        fireTableDataChanged();
    }

    public void delete(double startTime, double endTime) {
        if (startTime < 0.0 || endTime < startTime) {
            return;
        }

        final double originStart = getValue(startTime, true);
        final double originEnd = getValue(endTime, false);

        for (Iterator<LinePoint> iter = iterator(); iter.hasNext();) {

            LinePoint lp = iter.next();

            double pointTime = lp.getX();

            if (isPointInSelectionRegion(startTime, endTime, pointTime, 0)) {
                iter.remove();
            }
        }

        if (originStart != getValue(startTime, true)) {
            insertOrAdjust(startTime, originStart, true);
        }
        if (originEnd != getValue(endTime, false)) {
            insertOrAdjust(endTime, originEnd, false);
            if (originStart != originEnd) {
                insertOrAdjust(endTime, originStart, true);
            }
        }
        stripTimeDeadPoints();
        fireTableDataChanged();
    }

    public List<LinePoint> copy(double startTime, double endTime) {
        if (startTime < 0.0 || endTime < startTime) {
            return null;
        }

        final double originStart = getValue(startTime, false);
        final double originEnd = getValue(endTime, true);

        List<LinePoint> retVal = new ArrayList<>();

        for (Iterator<LinePoint> iter = iterator(); iter.hasNext();) {

            LinePoint lp = iter.next();

            double pointTime = lp.getX();

            if (isPointInSelectionRegion(startTime, endTime, pointTime, 0)) {
                retVal.add(new LinePoint(lp));
            }
        }

        stripOuterPoints(retVal, startTime, endTime);

        LinePoint startPoint = new LinePoint(startTime, originStart);
        LinePoint endPoint = new LinePoint(endTime, originEnd);
        if (retVal.size() > 0) {
            if (!startPoint.equals(retVal.get(0))) {
                retVal.add(0, startPoint);
            }
            if (!endPoint.equals(retVal.get(retVal.size() - 1))) {
                retVal.add(endPoint);
            }
        } else {
            retVal.add(startPoint);
            retVal.add(endPoint);
        }

        return retVal;
    }

    public void paste(List<LinePoint> points) {
        if (points == null || points.isEmpty()) {
            return;
        }

        double start = Double.POSITIVE_INFINITY;
        double end = Double.NEGATIVE_INFINITY;
        for (LinePoint p : points) {
            start = Math.min(start, p.getX());
            end = Math.max(end, p.getX());
        }

        final double originStart = getValue(start, false);
        final double originEnd = getValue(end, true);

        delete(start, end);

        LinePoint p;
        for (int i = 0; i < points.size() - 1; i++) {
            p = points.get(i);
            insertOrAdjust(p.getX(), p.getY(), false);
        }
        p = points.get(points.size() - 1);
        insertOrAdjust(p.getX(), p.getY(), true);

        // restoring outer points if necessary
        if (originStart != getValue(start, true)) {
            insertOrAdjust(start, originStart, true);
        }
        if (originEnd != getValue(end, false)) {
            insertOrAdjust(end, originEnd, false);
        }
        stripTimeDeadPoints();
        fireTableDataChanged();
    }

    private boolean isPointInSelectionRegion(
            double selectionStartTime,
            double selectionEndTime,
            double pointTime,
            double timeMod) {

        double min = selectionStartTime + timeMod;
        double max = selectionEndTime + timeMod;

        return pointTime >= min && pointTime <= max;
    }

    protected static void stripOuterPoints(List<LinePoint> points, double selectionStartTime, double selectionEndTime) {
        if (points.size() < 2) {
            return;
        }

        boolean found = false;
        for (int i = points.size() - 1; i >= 0; i--) {
            if (points.get(i).getX() == selectionStartTime) {
                if (found) {
                    points.remove(i);
                } else {
                    found = true;
                }
            }
        }

        found = false;
        for (Iterator<LinePoint> iter = points.iterator(); iter.hasNext();) {
            LinePoint lp = iter.next();
            if (lp.getX() == selectionEndTime) {
                if (found) {
                    iter.remove();
                } else {
                    found = true;
                }
            }
        }
    }

    public void stripTimeDeadPoints() {
        double time = -1.0;
        double lastVal = Double.NaN;
        boolean secondPointFound = false;
        boolean zeroPointFound = false;

        for (int i = points.size() - 1; i >= 0; i--) {
            LinePoint lp = points.get(i);

            if (lp.getX() == 0.0) {
                if (!zeroPointFound) {
                    zeroPointFound = true;
                } else {
                    points.remove(i);
                }
            } else if (lp.getX() == time) {
                if (lp.getY() == lastVal) {
                    points.remove(i);
                } else if (!secondPointFound) {
                    secondPointFound = true;
                } else {
                    points.remove(i + 1);
                }
                lastVal = lp.getY();
            } else {
                time = lp.getX();
                lastVal = lp.getY();
                secondPointFound = false;
            }
        }
    }
}
