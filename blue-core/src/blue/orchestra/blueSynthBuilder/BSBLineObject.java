/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.blueSynthBuilder;

import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.utility.NumberUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.Iterator;
import org.apache.commons.lang3.text.StrBuilder;

public class BSBLineObject extends BSBObject {

    int canvasWidth = 200;

    int canvasHeight = 160;

    double xMax = 1.0f;

    private LineList lines;

    boolean relativeXValues = true;

    boolean leadingZero = true;

    SeparatorType separatorType = SeparatorType.NONE;

    boolean locked = false;

    public BSBLineObject() {
        lines = new LineList();
    }

    public BSBLineObject(BSBLineObject lineObj) {
        super(lineObj);
        canvasWidth = lineObj.canvasWidth;
        canvasHeight = lineObj.canvasHeight;
        xMax = lineObj.xMax;
        lines = new LineList(lineObj.lines);
        relativeXValues = lineObj.relativeXValues;
        leadingZero = lineObj.leadingZero;
        separatorType = lineObj.separatorType;
        locked = lineObj.locked;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBLineObject lineObj = new BSBLineObject();
        initBasicFromXML(data, lineObj);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "canvasWidth":
                    lineObj.setCanvasWidth(XMLUtilities.readInt(node));
                    break;
                case "canvasHeight":
                    lineObj.setCanvasHeight(XMLUtilities.readInt(node));
                    break;
                case "xMax":
                    lineObj.setXMax(XMLUtilities.readDouble(node));
                    break;
                case "commaSeparated":
                    boolean val = XMLUtilities.readBoolean(node);
                    if (val) {
                        lineObj.setSeparatorType(SeparatorType.COMMA);
                    }
                    break;
                case "separatorType":
                    lineObj.setSeparatorType(
                            SeparatorType.fromString(node.getTextString()));
                    break;
                case "relativeXValues":
                    lineObj.setRelativeXValues(XMLUtilities.readBoolean(node));
                    break;
                case "lines":
                    lineObj.setLines(LineList.loadFromXML(node));
                    break;
                case "leadingZero":
                    lineObj.setLeadingZero(XMLUtilities.readBoolean(node));
                    break;
                case "locked":
                    lineObj.setLocked(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        return lineObj;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement(XMLUtilities.writeInt("canvasWidth", canvasWidth));
        retVal.addElement(XMLUtilities.writeInt("canvasHeight", canvasHeight));
        retVal.addElement(XMLUtilities.writeDouble("xMax", xMax));
        retVal.addElement(XMLUtilities.writeBoolean("relativeXValues",
                relativeXValues));
        retVal.addElement("separatorType").setText(separatorType.name());
        retVal
                .addElement(XMLUtilities.writeBoolean("leadingZero",
                        leadingZero));
        retVal.addElement(XMLUtilities.writeBoolean("locked", locked));
        retVal.addElement(lines.saveAsXML());

        return retVal;
    }

//    public BSBObjectView getBSBObjectView() {
//        return new BSBLineObjectView(this);
//    }
    @Override
    public String[] getReplacementKeys() {
        String[] vals = new String[lines.size()];
        String objName = getObjectName();

        for (int i = 0; i < lines.size(); i++) {
            Line l = lines.get(i);
            vals[i] = objName + "_" + l.getVarName();
        }

        return vals;
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        for (Iterator iter = lines.iterator(); iter.hasNext();) {
            Line line = (Line) iter.next();

            String key = getObjectName() + "_" + line.getVarName();
            String val = getLineString(line);

            compilationUnit.addReplacementValue(key, val);
        }
    }

    private String getLineString(Line line) {
        StrBuilder buffer = new StrBuilder();

        double[] xVals = new double[line.size()];
        double[] yVals = new double[line.size()];

        for (int i = 0; i < line.size(); i++) {
            LinePoint p = line.getLinePoint(i);

            xVals[i] = p.getX() * xMax;
            yVals[i] = p.getY();

        }

        if (relativeXValues) {
            for (int i = xVals.length - 1; i > 0; i--) {
                xVals[i] = xVals[i] - xVals[i - 1];
            }
        }

        String spacer = separatorType.getSeparatorString();

        if (isLeadingZero()) {
            buffer.append("0.0").append(spacer);
        }

        buffer.append(yVals[0]);

        for (int i = 1; i < xVals.length; i++) {
            buffer.append(spacer).append(NumberUtilities.formatDouble(xVals[i]));
            buffer.append(spacer).append(NumberUtilities.formatDouble(yVals[i]));
        }

        return buffer.toString();
    }

    @Override
    public String getPresetValue() {
        StringBuilder buffer = new StringBuilder();

        buffer.append("version=2");

        for (Iterator iter = lines.iterator(); iter.hasNext();) {
            buffer.append("@_@");

            Line line = (Line) iter.next();

            StringBuilder temp = new StringBuilder();
            temp.append(line.getVarName());

            for (int i = 0; i < line.size(); i++) {
                LinePoint pt = line.getLinePoint(i);
                temp.append(":").append(pt.getX());
                temp.append(":").append(pt.getY());
            }

            buffer.append(temp.toString());
        }

        // System.out.println(buffer.toString());
        return buffer.toString();
    }

    @Override
    public void setPresetValue(String val) {
        String[] parts = val.split("@_@");

        int version = 1;
        int startIndex = 0;

        if (parts[0].startsWith("version=")) {
            version = Integer.parseInt(parts[0].substring(8));
            startIndex = 1;
        }

        for (int i = startIndex; i < parts.length; i++) {
            String lineStr = parts[i];

            // System.out.println(lineStr);
            String[] vals = lineStr.split(":");

            String name = vals[0];

            Line line = getLineByName(name);

            if (line != null) {
                line.clear();

                double min = line.getMin();
                double max = line.getMax();
                double range = max - min;

                for (int j = 1; j < vals.length; j += 2) {
                    LinePoint p = new LinePoint();

                    double x = (Double.parseDouble(vals[j]));
                    double y = (Double.parseDouble(vals[j + 1]));

                    if (version == 1) {
                        y = (y * range) + min;
                    }

                    p.setLocation(x, y);

                    line.addLinePoint(p);
                }
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("presetValue", null, "preset");
        }
    }

    private Line getLineByName(String name) {
        for (Iterator iter = lines.iterator(); iter.hasNext();) {
            Line line = (Line) iter.next();
            if (line.getVarName().equals(name)) {
                return line;
            }
        }
        return null;
    }

    public void setLines(LineList lines) {
        this.lines = lines;
    }

    public LineList getLines() {
        return lines;
    }

    public int getCanvasHeight() {
        return canvasHeight;
    }

    public void setCanvasHeight(int canvasHeight) {
        int oldHeight = this.canvasHeight;

        this.canvasHeight = canvasHeight;

        if (propListeners != null) {
            propListeners.firePropertyChange("canvasHeight", oldHeight,
                    canvasHeight);
        }
    }

    public int getCanvasWidth() {
        return canvasWidth;
    }

    public void setCanvasWidth(int canvasWidth) {
        int oldWidth = this.canvasWidth;

        this.canvasWidth = canvasWidth;

        if (propListeners != null) {
            propListeners.firePropertyChange("canvasWidth", oldWidth,
                    canvasWidth);
        }
    }

    public double getXMax() {
        return xMax;
    }

    public void setXMax(double max) {
        double oldMax = xMax;
        xMax = max;

        if (propListeners != null) {
            propListeners.firePropertyChange("yMax", new Double(oldMax),
                    new Double(xMax));
        }
    }

    public boolean isRelativeXValues() {
        return relativeXValues;
    }

    public void setRelativeXValues(boolean relativeXValues) {
        this.relativeXValues = relativeXValues;
    }

    public boolean isLeadingZero() {
        return leadingZero;
    }

    public void setLeadingZero(boolean leadingZero) {
        this.leadingZero = leadingZero;
    }

    public boolean isLocked() {
        return locked;
    }

    public void setLocked(boolean locked) {
        this.locked = locked;
    }

    public SeparatorType getSeparatorType() {
        return separatorType;
    }

    public void setSeparatorType(SeparatorType separatorType) {
        this.separatorType = separatorType;
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBLineObject(this);
    }

    public enum SeparatorType {
        NONE("None", " "), COMMA("Comma", ", "), SINGLE_QUOTE("Single Quote", "' ");

        private final String value;
        private final String separatorString;

        private SeparatorType(String value, String separatorString) {
            this.value = value;
            this.separatorString = separatorString;
        }

        public static SeparatorType fromString(String string) {
            switch (string) {
                case "None":
                    return NONE;
                case "Comma":
                    return COMMA;
                case "Single Quote":
                    return SINGLE_QUOTE;
            }
            return SeparatorType.valueOf(string);
        }

        public String getSeparatorString() {
            return separatorString;
        }

        @Override
        public String toString() {
            return value;
        }
    };
}
