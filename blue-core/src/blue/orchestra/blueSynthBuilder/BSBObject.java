/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.Serializable;
import java.util.Iterator;
import java.util.Vector;

import org.apache.commons.lang.builder.EqualsBuilder;

//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import blue.utility.ObjectUtilities;
import electric.xml.Element;

/**
 * @author Steven Yi
 * 
 */
public abstract class BSBObject implements Serializable, Cloneable {

    /**
     * Object name should be non-null and unique within BSBGraphicsInterface
     * collection
     */
    String objectName = "";

    // String label = "";

    int x = 0, y = 0;

    transient Vector listeners = null;

    transient PropertyChangeSupport propListeners = null;

    transient UniqueNameManager unm = null;

    /**
     * @return Returns the x.
     */
    public int getX() {
        return x;
    }

    /**
     * @param x
     *            The x to set.
     */
    public void setX(int x) {
        this.x = x;
    }

    /**
     * @return Returns the y.
     */
    public int getY() {
        return y;
    }

    /**
     * @param y
     *            The y to set.
     */
    public void setY(int y) {
        this.y = y;
    }

    /**
     * @return Returns the objectName.
     */
    public String getObjectName() {
        return objectName;
    }

    /**
     * @param objectName
     *            The objectName to set.
     */
    public void setObjectName(String objectName) {
        String oldName = this.objectName;

        if (oldName == objectName || oldName.equals(objectName)) {
            return;
        }

        if (unm != null) {
            if (objectName != null && !objectName.equals("")
                    && !unm.isUnique(objectName)) {
                return;
            }
        }

        this.objectName = objectName;

        if (propListeners != null) {
            propListeners.firePropertyChange("objectName", oldName,
                    this.objectName);
        }
    }

    /**
     * Returns the names of keys generated by this BSBObject
     * 
     * @return
     */
    public String[] getReplacementKeys() {
        String name = getObjectName();

        if (name == null || name.trim().length() == 0) {
            return new String[] {};
        } else {
            return new String[] { name };
        }

    }

    /*
     * public String getLabel() { if (this.label.equals("")) { return
     * this.objectName; } return label; }
     * 
     * public void setLabel(String label) { this.label = label; }
     */

    // public static abstract BlueSynthBuilderObject loadFromXML(Element data);
    public abstract Element saveAsXML();

//    public abstract BSBObjectView getBSBObjectView();

    public abstract void setupForCompilation(BSBCompilationUnit compilationUnit);

    public static void initBasicFromXML(Element data, BSBObject bsbObj) {
        String name = data.getTextString("objectName");

        name = (name == null) ? "" : name;

        bsbObj.setObjectName(name);
        bsbObj.setX(Integer.parseInt(data.getTextString("x")));
        bsbObj.setY(Integer.parseInt(data.getTextString("y")));
    }

    public static Element getBasicXML(BSBObject bsbObj) {
        Element retVal = new Element("bsbObject");
        retVal.setAttribute("type", bsbObj.getClass().getName());

        retVal.addElement("objectName").setText(bsbObj.getObjectName());

        retVal.addElement("x").setText(Integer.toString(bsbObj.getX()));
        retVal.addElement("y").setText(Integer.toString(bsbObj.getY()));

        return retVal;

    }

    public abstract String getPresetValue();

    public abstract void setPresetValue(String val);

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    // EVENT LISTENERS

    public void addListener(BSBObjectListener listener) {
        if (listeners == null) {
            listeners = new Vector();
        }

        listeners.add(listener);
    }

    public void removeListener(BSBObjectListener listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    protected void fireBSBObjectChanged() {
        if (listeners != null) {
            Iterator it = listeners.iterator();
            while (it.hasNext()) {
                BSBObjectListener currListener = (BSBObjectListener) it.next();
                currListener.bsbObjectChanged(this);
            }
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            propListeners = new PropertyChangeSupport(this);
        }

        propListeners.addPropertyChangeListener(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners != null) {
            propListeners.removePropertyChangeListener(pcl);
        }
    }

    public void setUniqueNameManager(UniqueNameManager unm) {
        this.unm = unm;
    }
}