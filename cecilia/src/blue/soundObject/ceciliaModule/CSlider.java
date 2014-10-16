/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject.ceciliaModule;

import electric.xml.Element;

public class CSlider extends CeciliaObject {

    public static int REL_LINEAR = 0;

    public static int REL_LOGARITHMIC = 1;

    float min = 0.0f;

    float max = 100.0f;

    boolean isKrate = true;

    float resolution = 0.1f;

    boolean isHorizontal = true;

    String unit = "x";

    int rel = REL_LINEAR;

    boolean isInteger = false;

    // Color color =
    // int width = 0; // default to 0 or min

    float value = 0.0f;

    public String processText(String ceciliaText) {
        // TODO Auto-generated method stub
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#initialize(java.lang.String[])
     */
    public void initialize(String[] tokens) {
        this.setObjectName(tokens[1]);

        boolean setInitValue = false;
        float initValue = Float.NaN;

        for (int i = 2; i < tokens.length; i += 2) {
            if (tokens[i].equals("-label")) {
                this.setLabel(tokens[i + 1]);
            } else if (tokens[i].equals("-min")) {
                this.setMin(Float.parseFloat(tokens[i + 1]));
            } else if (tokens[i].equals("-max")) {
                this.setMax(Float.parseFloat(tokens[i + 1]));
            } else if (tokens[i].equals("-rel")) {
                if (tokens[i + 1].equals("lin")) {
                    this.setRel(REL_LINEAR);
                } else if (tokens[i + 1].equals("log")) {
                    this.setRel(REL_LOGARITHMIC);
                }
            } else if (tokens[i].equals("-unit")) {
                this.setUnit(tokens[i + 1]);
            } else if (tokens[i].equals("-init")) {
                initValue = Float.parseFloat(tokens[i + 1]);
                setInitValue = true;
            } else if (tokens[i].equals("-res")) {
                isInteger = tokens[i + 1].trim().equals("1");
                float res = Float.parseFloat(tokens[i + 1].trim());
                this.setResolution(res);
            }
        }

        if (setInitValue) {
            System.out.println("INIT VALUE: " + initValue);
            this.setValue(initValue);
        } else {
            this.setValue(this.getMin());
        }

    }

    /**
     * @return Returns the isHorizonal.
     */
    public boolean isHorizontal() {
        return isHorizontal;
    }

    /**
     * @param isHorizonal
     *            The isHorizonal to set.
     */
    public void setHorizontal(boolean isHorizonal) {
        this.isHorizontal = isHorizonal;
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
    public void setMax(float max) {
        this.max = max;
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
    public void setMin(float min) {
        this.min = min;
    }

    /**
     * @return Returns the rel.
     */
    public int getRel() {
        return rel;
    }

    /**
     * @param rel
     *            The rel to set.
     */
    public void setRel(int rel) {
        this.rel = rel;
    }

    /**
     * @return Returns the resolution.
     */
    public float getResolution() {
        return resolution;
    }

    /**
     * @param resolution
     *            The resolution to set.
     */
    public void setResolution(float resolution) {
        this.resolution = resolution;
    }

    /**
     * @return Returns the unit.
     */
    public String getUnit() {
        return unit;
    }

    /**
     * @param unit
     *            The unit to set.
     */
    public void setUnit(String unit) {
        this.unit = unit;
    }

    /**
     * @return Returns the value.
     */
    public float getValue() {
        return value;
    }

    public String getValueAsString() {
        if (isInteger) {
            return Integer.toString((int) value);
        }

        return Float.toString(value);
    }

    /**
     * @param value
     *            The value to set.
     */
    public void setValue(float value) {
        this.value = value;
    }

    /**
     * @return Returns the isKrate.
     */
    public boolean isKrate() {
        return isKrate;
    }

    /**
     * @param isKrate
     *            The isKrate to set.
     */
    public void setKrate(boolean isKrate) {
        this.isKrate = isKrate;
    }

    public static CeciliaObject loadFromXML(Element data) {
        CSlider cslider = new CSlider();

        CeciliaObject.initBasicFromXML(data, cslider);

        cslider.setMin(Float.parseFloat(data.getTextString("min")));
        cslider.setMax(Float.parseFloat(data.getTextString("max")));
        cslider.setUnit(data.getTextString("unit"));
        cslider.setRel(Integer.parseInt(data.getTextString("rel")));
        cslider.setResolution(Float
                .parseFloat(data.getTextString("resolution")));
        cslider.setValue(Float.parseFloat(data.getTextString("value")));
        cslider.setHorizontal(Boolean.valueOf(
                data.getTextString("isHorizontal")).booleanValue());
        cslider.setKrate(Boolean.valueOf(data.getTextString("isKrate"))
                .booleanValue());
        cslider.isInteger = Boolean.valueOf(data.getTextString("isInteger"))
                .booleanValue();

        return cslider;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = CeciliaObject.getBasicXML(this);

        retVal.addElement("min").setText(Float.toString(this.getMin()));
        retVal.addElement("max").setText(Float.toString(this.getMax()));
        retVal.addElement("unit").setText(this.getUnit());
        retVal.addElement("rel").setText(Integer.toString(this.getRel()));
        retVal.addElement("resolution").setText(
                Float.toString(this.getResolution()));
        retVal.addElement("value").setText(Float.toString(this.getValue()));
        retVal.addElement("isHorizontal").setText(
                Boolean.toString(this.isHorizontal()));
        retVal.addElement("isKrate").setText(Boolean.toString(this.isKrate()));
        retVal.addElement("isInteger")
                .setText(Boolean.toString(this.isInteger));

        return retVal;
    }

    /**
     * @return
     */
    public String generateSliderText() {

        String val = Float.toString(this.getValue());
        String retVal = "gk" + this.getObjectName() + " init " + val + "\n";
        retVal += "gi" + this.getObjectName() + " init " + val + "\n";

        return retVal;
    }
}