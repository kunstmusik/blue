/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
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

import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.StringTokenizer;

public class CGraph extends CeciliaObject implements Serializable {

    public static int REL_LINEAR = 0;

    public static int REL_LOGARITHMIC = 1;

    public static int REL_RAW = 2;

    float min = 0.0f;

    float max = 100.0f;

    String unit = "x";

    int rel = REL_LINEAR;

    int gen = -1; // automatic

    int size = -1; // power of 2 size, default to user preference

    ArrayList points = new ArrayList();

    String color = "";

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#processText(java.lang.String)
     */
    @Override
    public String processText(String ceciliaText) {
        // TODO Auto-generated method stub
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#initialize(java.lang.String[])
     */
    @Override
    public void initialize(String[] tokens) {
        this.setObjectName(tokens[1]);

        boolean setInitValue = false;
        float initValue = Float.NaN;

        for (int i = 2; i < tokens.length; i += 2) {
            switch (tokens[i]) {
                case "-label":
                    this.setLabel(tokens[i + 1]);
                    break;
                case "-min":
                    this.setMin(Float.parseFloat(tokens[i + 1]));
                    break;
                case "-max":
                    this.setMax(Float.parseFloat(tokens[i + 1]));
                    break;
                case "-rel":
                    switch (tokens[i + 1]) {
                        case "lin":
                            this.setRel(REL_LINEAR);
                            break;
                        case "log":
                            this.setRel(REL_LOGARITHMIC);
                            break;
                        case "raw":
                            this.setRel(REL_RAW);
                            break;
                        default:
                            break;
                    }
                    break;
                case "-unit":
                    this.setUnit(tokens[i + 1]);
                    break;
                case "-gen":
                    this.setGen(Integer.parseInt(tokens[i + 1]));
                    break;
                case "-size":
                    this.setSize(Integer.parseInt(tokens[i + 1]));
                    break;
                case "-init":
                    initValue = Float.parseFloat(tokens[i + 1]);
                    setInitValue = true;
                    break;
                case "-func":
                    parseFuncString(tokens[i + 1]);
                    setInitValue = false;
                    break;
                default:
                    break;
            }
        }
        if (setInitValue) {
            CGraphPoint point1 = new CGraphPoint();
            CGraphPoint point2 = new CGraphPoint();

            point1.time = 0.0f;
            point2.time = 1.0f;

            float range = this.getMax() - this.getMin();

            if (Float.isNaN(initValue)) {
                point1.value = 0.0f;
                point2.value = 0.0f;
            } else {
                point1.value = (initValue - this.getMin()) / range;
                point2.value = (initValue - this.getMin()) / range;
            }

            points.add(point1);
            points.add(point2);
        }
    }

    private void parseFuncString(String funcString) {
        StringTokenizer st = new StringTokenizer(funcString);
        float time = 0;
        float val = 0;

        int type = 0;

        points.clear();

        while (st.hasMoreTokens()) {
            if (type == 0) {
                time = Float.parseFloat(st.nextToken());
                type = 1;
            } else {
                val = Float.parseFloat(st.nextToken());

                CGraphPoint point = new CGraphPoint();
                point.time = time;
                point.value = val;

                points.add(point);

                type = 0;
            }
        }
    }

    /**
     * @return
     */
    public float getMax() {
        return max;
    }

    /**
     * @return
     */
    public float getMin() {
        return min;
    }

    /**
     * @return
     */
    public int getRel() {
        return rel;
    }

    /**
     * @return
     */
    public int getSize() {
        return size;
    }

    /**
     * @return
     */
    public String getUnit() {
        return unit;
    }

    /**
     * @param f
     */
    public void setMax(float f) {
        max = f;
    }

    /**
     * @param f
     */
    public void setMin(float f) {
        min = f;
    }

    /**
     * @param i
     */
    public void setRel(int i) {
        rel = i;
    }

    /**
     * @param i
     */
    public void setSize(int i) {
        size = i;
    }

    /**
     * @param string
     */
    public void setUnit(String string) {
        unit = string;
    }

    /**
     * @return
     */
    public int getGen() {
        return gen;
    }

    /**
     * @param i
     */
    public void setGen(int i) {
        gen = i;
    }

    /**
     * @return Returns the points.
     */
    public ArrayList getPoints() {
        return points;
    }

    /**
     * @param points
     *            The points to set.
     */
    public void setPoints(ArrayList points) {
        this.points = points;
    }

    /**
     * @return Returns the color.
     */
    public String getColor() {
        return color;
    }

    /**
     * @param color
     *            The color to set.
     */
    public void setColor(String color) {
        this.color = color;
    }

    public static CeciliaObject loadFromXML(Element data) {
        CGraph cgraph = new CGraph();

        CeciliaObject.initBasicFromXML(data, cgraph);

        cgraph.setMin(Float.parseFloat(data.getTextString("min")));
        cgraph.setMax(Float.parseFloat(data.getTextString("max")));
        cgraph.setUnit(data.getTextString("unit"));
        cgraph.setRel(Integer.parseInt(data.getTextString("rel")));
        cgraph.setGen(Integer.parseInt(data.getTextString("gen")));
        cgraph.setSize(Integer.parseInt(data.getTextString("size")));

        String color = data.getTextString("color");

        cgraph.setColor(color == null ? "" : color);

        Elements pointNodes = data.getElements("cgraphPoint");

        while (pointNodes.hasMoreElements()) {
            CGraphPoint cgp = CGraphPoint.loadFromXML(pointNodes.next());
            cgraph.points.add(cgp);
        }

        return cgraph;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = CeciliaObject.getBasicXML(this);

        retVal.addElement("min").setText(Float.toString(this.getMin()));
        retVal.addElement("max").setText(Float.toString(this.getMax()));
        retVal.addElement("unit").setText(this.getUnit());
        retVal.addElement("rel").setText(Integer.toString(this.getRel()));
        retVal.addElement("gen").setText(Integer.toString(this.getGen()));
        retVal.addElement("size").setText(Integer.toString(this.getSize()));
        retVal.addElement("color").setText(this.getColor());

        for (Iterator iter = points.iterator(); iter.hasNext();) {
            CGraphPoint cgp = (CGraphPoint) iter.next();

            retVal.addElement(cgp.saveAsXML());
        }

        return retVal;
    }

    public CGraph copy() {
        return (CGraph) ObjectUtilities.clone(this);
    }

    public void replaceValues(CGraph cgraph) {
        System.out.println("Cgraph :" + this + " : " + cgraph);

        ArrayList pointsCopy = (ArrayList) ObjectUtilities.clone(cgraph
                .getPoints());
        this.setPoints(pointsCopy);
    }
}