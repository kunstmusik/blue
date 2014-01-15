/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.blueSynthBuilder;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;

/**
 *
 * @author stevenyi
 */
public class GridSettings {

    public static enum GridStyle {
        NONE, DOT, LINE
//        NONE(0), DOT(1), LINE(2);
//        private int value;
//
//        GridStyle(int value) {
//            this.value = value;
//        }
//        public int getValue() {
//            return value;
//        }
    }
    
    private int width = 15;
    private int height = 15;
    private GridStyle gridStyle = GridStyle.DOT;
    private boolean snapEnabled = true;

    private transient PropertyChangeSupport propSupport;

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        int oldWidth = this.width;
        this.width = width;

        if (propSupport != null && width != oldWidth) {
            propSupport.firePropertyChange("width", oldWidth, width);
        }
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        int oldHeight = this.height;
        this.height = height;
        if (propSupport != null && height != oldHeight) {
            propSupport.firePropertyChange("height", oldHeight, height);
        }
    }

    public GridStyle getGridStyle() {
        return gridStyle;
    }

    public void setGridStyle(GridStyle gridStyle) {
        GridStyle oldVal = this.gridStyle;
        this.gridStyle = gridStyle;

        if (propSupport != null && !oldVal.equals(gridStyle)) {
            propSupport.firePropertyChange("gridStyle", oldVal, gridStyle);
        }
    }

    

    public boolean isSnapEnabled() {
        return snapEnabled;
    }

    public void setSnapEnabled(boolean snapEnabled) {
        boolean oldVal = this.snapEnabled;
        this.snapEnabled = snapEnabled;
        if (propSupport != null && oldVal != snapEnabled) {
            propSupport.firePropertyChange("snapEnabled", oldVal, snapEnabled);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propSupport == null) {
            propSupport = new PropertyChangeSupport(this);
        }
        propSupport.addPropertyChangeListener(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (propSupport != null) {
            propSupport.removePropertyChangeListener(pcl);
        }
    }

    public static GridSettings loadFromXML(Element data)
            throws Exception {
        GridSettings gridSettings = new GridSettings();

        Elements giNodes = data.getElements();

        while (giNodes.hasMoreElements()) {
            Element node = giNodes.next();
            String name = node.getName();

            switch (name) {
                case "width":
                    gridSettings.width = XMLUtilities.readInt(node);
                    break;
                case "height":
                    gridSettings.height = XMLUtilities.readInt(node);
                    break;
                case "gridStyle":
                    gridSettings.gridStyle = GridStyle.valueOf(node.getTextString());
                    break;
                case "snapGridEnabled":
                    gridSettings.snapEnabled = XMLUtilities.readBoolean(node);
                    break;
            }
        }

        return gridSettings;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("gridSettings");

        retVal.addElement(XMLUtilities.writeInt("width", width));
        retVal.addElement(XMLUtilities.writeInt("height", height));
        retVal.addElement(new Element("gridStyle").setText(gridStyle.toString()));
        retVal.addElement(XMLUtilities.writeBoolean("snapGridEnabled",
                snapEnabled));

        return retVal;
    }
}
