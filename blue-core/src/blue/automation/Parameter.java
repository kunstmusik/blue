/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.automation;

import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.components.lines.LineUtils;
import electric.xml.Element;
import electric.xml.Elements;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.rmi.dgc.VMID;
import java.util.Vector;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * Data class to describe an automatable parameter's properties. This class
 * should holds boundary information (min and max) as well as allows for
 * listeners to follow changes to parameter information. A default value is also
 * necessary.
 *
 * @author steven
 */
public class Parameter implements TableModelListener {

    private double min = 0.0f;
    private double max = 1.0f;
    private double value = 0.0f;
    private String name = "";
    private String label = "";
    private BigDecimal resolution = new BigDecimal(-1);
    private BooleanProperty automationEnabled = new SimpleBooleanProperty(false);

    private boolean updatingLine = false;
    private String uniqueId;
    private Line line;
    transient Vector<ParameterListener> listeners;

    /* Used only at compilation time; not transient as it should be copied. 
    *  FIXME: this should be rewrittten. 
     */
    private String compilationVarName = null;

    /**
     * Creates a new instance of Parameter
     */
    public Parameter() {
        line = new Line(false);
        line.addTableModelListener(this);

        uniqueId = Integer.toString(new VMID().hashCode());
    }

    public Parameter(Parameter param) {
        min = param.min;
        max = param.max;
        value = param.value;
        name = param.name;
        label = param.label;
        resolution = param.resolution;
        line = new Line(param.line);
        line.addTableModelListener(this);
        setAutomationEnabled(param.isAutomationEnabled());
        uniqueId = param.uniqueId;
        compilationVarName = param.compilationVarName;
    }

    /* Change Listener Code */
    public void addParameterListener(ParameterListener listener) {
        if (listeners == null) {
            listeners = new Vector<>();
        }
        listeners.add(listener);
    }

    public void removeParameterListener(ParameterListener listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    private void fireParameterChanged() {
        if (listeners == null) {
            return;
        }

        for (ParameterListener cl : listeners) {
            cl.parameterChanged(this);
        }
    }

    private void fireLineDataChanged() {
        if (listeners == null) {
            return;
        }
        for (ParameterListener cl : listeners) {
            cl.lineDataChanged(this);
        }
    }

    public void fireUpdateFromTimeChange() {
        fireLineDataChanged();
    }

    /* GETTER/SETTER CODE */
    public double getMin() {
        return min;
    }

    public double getMax() {
        return max;
    }

    public void setMin(double min, boolean truncate) {
        double oldMin = this.min;
        this.min = min;

        updatingLine = true;
        line.setMin(min, truncate);

        if (truncate) {
            value = LineUtils.truncate(value, this.min, this.max);
        } else {
            value = LineUtils.rescale(value, oldMin, this.max,
                    this.min, this.max, this.resolution);
        }

        updatingLine = false;

        fireParameterChanged();
    }

    public void setMax(double max, boolean truncate) {
        double oldMax = this.max;
        this.max = max;

        updatingLine = true;
        line.setMax(max, truncate);

        if (truncate) {
            value = LineUtils.truncate(value, this.min, this.max);
        } else {
            value = LineUtils.rescale(value, this.min, oldMax,
                    this.min, this.max, this.resolution);
        }

        updatingLine = false;

        fireParameterChanged();
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;

        fireParameterChanged();
    }

    public BigDecimal getResolution() {
        return resolution;
    }

    public void setResolution(BigDecimal resolution) {
        // if(this.resolution == resolution) {
        // return;
        // }

        this.resolution = resolution;

        this.line.setResolution(resolution);
    }

    public Line getLine() {
        return line;
    }

    public void setLine(Line line) {
        this.line = line;
    }

    public String getUniqueId() {
        return uniqueId;
    }

    /* Listening to Line Value Changes to fire events to update UI */
    @Override
    public void tableChanged(TableModelEvent e) {
        if (!updatingLine) {
            fireLineDataChanged();
        }
    }

    public void setValue(double value) {

        if (isAutomationEnabled()) {

            double time = ParameterTimeManagerFactory.getInstance().getTime();

            if (time < 0) {
                return;
            }

            updatingLine = true;
            LinePoint found = null;
            for (int i = 0; i < line.size(); i++) {
                LinePoint point = line.getLinePoint(i);
                if (point.getX() == time) {
                    found = point;
                    break;
                }

            }

            if (found != null) {
                found.setLocation(found.getX(), value);
            } else {
                LinePoint lp = new LinePoint();
                lp.setLocation(time, value);
                line.insertLinePoint(lp);
            }

            updatingLine = false;
        } else {

            this.value = value;

            if (line.size() == 1) {
                updatingLine = true;

                LinePoint lp = line.getLinePoint(0);
                lp.setLocation(lp.getX(), value);

                updatingLine = false;
            }
        }

    }

    public double getValue(double time) {
        double retValue;

        if (isAutomationEnabled()) {
            retValue = line.getValue(time);
        } else {
            retValue = this.value; // line.getLinePoint(0).getY();
        }

        return retValue;
    }

    public double getFixedValue() {
        return this.value;
    }

    public final void setAutomationEnabled(boolean value) {
        automationEnabled.set(value);
    }

    public final boolean isAutomationEnabled() {
        return automationEnabled.get();
    }

    public final BooleanProperty automationEnabledProperty() {
        return automationEnabled;
    }

    /* SERIALIZATION CODE */
    public Element saveAsXML() {
        Element retVal = new Element("parameter");

        retVal.setAttribute("uniqueId", uniqueId);
        retVal.setAttribute("name", name);
        retVal.setAttribute("label", label);
        retVal.setAttribute("min", Double.toString(min));
        retVal.setAttribute("max", Double.toString(max));
        retVal.setAttribute("bdresolution", resolution.toString());
        retVal.setAttribute("automationEnabled", Boolean
                .toString(isAutomationEnabled()));
        retVal.setAttribute("value", Double.toString(value));

        retVal.addElement(line.saveAsXML());

        return retVal;
    }

    public static Parameter loadFromXML(Element data) {
        Parameter retVal = new Parameter();

        String val = data.getAttributeValue("uniqueId");
        if (val != null && val.length() > 0) {
            retVal.uniqueId = val;
        }

        val = data.getAttributeValue("name");
        if (val != null && val.length() > 0) {
            retVal.name = val;
        }

        val = data.getAttributeValue("label");
        if (val != null && val.length() > 0) {
            retVal.label = val;
        }

        val = data.getAttributeValue("min");
        if (val != null && val.length() > 0) {
            retVal.min = Double.parseDouble(val);
        }

        val = data.getAttributeValue("max");
        if (val != null && val.length() > 0) {
            retVal.max = Double.parseDouble(val);
        }

        // Blue 2.7.0 - updated to use big decimal, this remains
        // to parse older double values from projects
        val = data.getAttributeValue("resolution");
        if (val != null && val.length() > 0) {
            double res = Double.parseDouble(val);
            retVal.resolution = new BigDecimal(res)
                    .setScale(5, RoundingMode.HALF_UP)
                    .stripTrailingZeros();
        }

        val = data.getAttributeValue("bdresolution");
        if (val != null && val.length() > 0) {
            retVal.resolution = new BigDecimal(val);
        }

        val = data.getAttributeValue("automationEnabled");
        if (val != null && val.length() > 0) {
            retVal.setAutomationEnabled(Boolean.valueOf(val).booleanValue());
        }

        Elements nodes = data.getElements();
        while (nodes.hasMoreElements()) {

            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("line")) {
                retVal.line = Line.loadFromXML(node);
                retVal.line.addTableModelListener(retVal);
            }

        }

        /*
         * For checking of older projects where line did not have resolution
         * property (0.111.0)
         */
        if (retVal.line.getResolution() != retVal.getResolution()) {
            retVal.line.setResolution(retVal.getResolution());
        }

        /*
         * Seeting Value property from first line point, introduced in 0.124.0
         */
        val = data.getAttributeValue("value");
        if (val != null && val.length() > 0) {
            retVal.value = Double.parseDouble(val);
        }

        return retVal;
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof Parameter)) {
            return false;
        }

        Parameter other = (Parameter) obj;

        return new EqualsBuilder()
                .append(uniqueId, other.uniqueId)
                .append(min, other.min)
                .append(max, other.max)
                .append(label, other.label)
                .append(resolution, other.resolution)
                .append(line, other.line)
                .append(automationEnabled.get(), other.automationEnabled.get())
                .append(updatingLine, other.updatingLine)
                .append(value, other.value)
                .isEquals();

    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getCompilationVarName() {
        return compilationVarName;
    }

    public void setCompilationVarName(String compilationVarName) {
        this.compilationVarName = compilationVarName;
    }
}
