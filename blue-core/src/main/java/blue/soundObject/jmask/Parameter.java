/*
 * blue - object composition environment for csound
 * Copyright (c) 2007 Steven Yi (stevenyi@gmail.com)
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

import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Parameter {

    private boolean visible = true;

    private Generator generator = null;

    private Mask mask = null;

    private Quantizer quantizer = null;

    private Accumulator accumulator = null;

    private transient PropertyChangeSupport propSupport = null;

    private String name = "";

    public Parameter() {
    }

    public Parameter(Parameter param) {
        visible = param.visible;
        if(param.generator != null) {
            generator = param.generator.deepCopy();
        }
        if(param.mask != null) {
            mask = new Mask(param.mask); 
        }
        if(param.quantizer != null) {
            quantizer = new Quantizer(param.quantizer);
        }
        if(param.accumulator != null) {
            accumulator = new Accumulator(param.accumulator);
        }
        name = param.name;
    }

    public static Parameter create(Generator generator) {
        Parameter param = new Parameter();
        param.setGenerator(generator);

        if (generator instanceof Maskable) {
            param.setMask(new Mask());
        }

        if (generator instanceof Accumulatable) {
            param.setAccumulator(new Accumulator());
        }

        if (generator instanceof Quantizable) {
            param.setQuantizer(new Quantizer());
        }

        return param;
    }

    public double getValue(double time, java.util.Random rnd) {
        double val = generator.getValue(time, rnd);

        if (mask != null && mask.isEnabled()) {
            val = mask.getValue(time, val);
        }

        if (quantizer != null && quantizer.isEnabled()) {
            val = quantizer.getValue(time, val);
        }

        if (accumulator != null && accumulator.isEnabled()) {
            val = accumulator.getValue(time, val);
        }

        return val;
    }

    public Generator getGenerator() {
        return generator;
    }

    public void setGenerator(Generator generator) {
        this.generator = generator;
    }

    public Mask getMask() {
        return mask;
    }

    public void setMask(Mask mask) {
        this.mask = mask;
    }

    public Quantizer getQuantizer() {
        return quantizer;
    }

    public void setQuantizer(Quantizer quantizer) {
        this.quantizer = quantizer;
    }

    public Accumulator getAccumulator() {
        return accumulator;
    }

    public void setAccumulator(Accumulator accumulator) {
        this.accumulator = accumulator;
    }

    public String getName() {
        return name;
    }

    public void setName(String fieldName) {
        this.name = fieldName;
    }

    public static Parameter loadFromXML(Element data) throws Exception {
        Parameter parameter = new Parameter();

        if (data.getAttributeValue("visible") != null) {
            boolean visible = Boolean.valueOf(
                    data.getAttributeValue("visible")).booleanValue();
            parameter.setVisible(visible);
        }

        if (data.getAttributeValue("name") != null) {
            parameter.setName(data.getAttributeValue("name"));

        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "generator":
                    parameter.generator = (Generator) ObjectUtilities
                            .loadFromXML(node);
                    break;
                case "mask":
                    parameter.mask = Mask.loadFromXML(node);
                    break;
                case "quantizer":
                    parameter.quantizer = Quantizer.loadFromXML(node);
                    break;
                case "accumulator":
                    parameter.accumulator = Accumulator.loadFromXML(node);
                    break;
            }
        }

        return parameter;
    }

    public Element saveAsXML() {
        Element retVal = new Element("parameter");
        retVal.setAttribute("visible", Boolean.toString(visible));
        retVal.setAttribute("name", getName());

        retVal.addElement(generator.saveAsXML());

        if (mask != null) {
            retVal.addElement(mask.saveAsXML());
        }

        if (quantizer != null) {
            retVal.addElement(quantizer.saveAsXML());
        }

        if (accumulator != null) {
            retVal.addElement(accumulator.saveAsXML());
        }

        return retVal;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public void initialize(double duration) {
        generator.initialize(duration);

        if (mask != null) {
            mask.setDuration(duration);
        }

        if (quantizer != null) {
            quantizer.setDuration(duration);
        }

        if (accumulator != null) {
            accumulator.setDuration(duration);
        }
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        if (this.visible == visible) {
            return;
        }

        this.visible = visible;

        if (propSupport != null) {
            propSupport.firePropertyChange("visible", !visible, visible);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propSupport == null) {
            propSupport = new PropertyChangeSupport(this);
        }

        for (PropertyChangeListener listener : propSupport.getPropertyChangeListeners()) {
            if (listener == pcl) {
                return;
            }
        }
        propSupport.addPropertyChangeListener(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (propSupport != null) {
            propSupport.removePropertyChangeListener(pcl);
        }
    }

}
