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
package blue.orchestra.blueSynthBuilder;

import blue.orchestra.blueSynthBuilder.GridSettings.GridStyle;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.Vector;
import org.apache.commons.lang3.builder.EqualsBuilder;

/**
 * Stores BSBObjects, notification of changes used by BSBParameterList to keep
 * BSBParameters in sync with BSBObjects
 *
 * @author steven
 *
 */
public class BSBGraphicInterface implements Serializable, UniqueNameCollection {

    ArrayList<BSBObject> interfaceItems = new ArrayList<BSBObject>();

    UniqueNameManager nameManager = new UniqueNameManager();

    transient Vector<BSBGraphicInterfaceListener> listeners = null;

    private boolean editEnabled = true;

    private GridSettings gridSettings = new GridSettings();

    public BSBGraphicInterface() {
        nameManager.setUniqueNameCollection(this);
        nameManager.setDefaultPrefix("bsbObj");
    }

    public BSBObject getBSBObject(int index) {
        return (BSBObject) interfaceItems.get(index);
    }

    public void addBSBObject(BSBObject bsbObj) {
        if (bsbObj == null) {
            return;
        }

        String objName = bsbObj.getObjectName();

        // guarantee unique names for objects
        if (objName != null && objName.length() != 0) {
            if (!nameManager.isUniquelyNamed(bsbObj)) {
                nameManager.setUniqueName(bsbObj);
            }
        }

        interfaceItems.add(bsbObj);
        fireBSBObjectAdded(bsbObj);
        bsbObj.setUniqueNameManager(nameManager);
    }

    public void remove(BSBObject bsbObj) {
        if (interfaceItems.contains(bsbObj)) {
            interfaceItems.remove(bsbObj);
            fireBSBObjectRemoved(bsbObj);
            bsbObj.setUniqueNameManager(null);
        }
    }

    public Iterator<BSBObject> iterator() {
        return interfaceItems.iterator();
    }

    public int size() {
        return interfaceItems.size();
    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        for (Iterator<BSBObject> iter = interfaceItems.iterator(); iter.hasNext();) {
            BSBObject bsbObj = iter.next();
            bsbObj.setupForCompilation(compilationUnit);
        }
    }

    public static BSBGraphicInterface loadFromXML(Element data)
            throws Exception {
        BSBGraphicInterface graphicInterface = new BSBGraphicInterface();

        Elements giNodes = data.getElements();

        String editEnabledStr = data.getAttributeValue("editEnabled");
        if (editEnabledStr != null) {
            graphicInterface.setEditEnabled(Boolean.valueOf(editEnabledStr)
                    .booleanValue());
        }

        GridSettings gridSettings = null;
        
        while (giNodes.hasMoreElements()) {
            Element node = giNodes.next();
            String name = node.getName();

            switch (name) {
                case "bsbObject":
                    Object obj = ObjectUtilities.loadFromXML(node);
                    graphicInterface.addBSBObject((BSBObject) obj);
                    break;
                case "gridSettings":
                    gridSettings = GridSettings.loadFromXML(node);
                    break;
            }
        }

        if(gridSettings == null) {
            // preserve behavior of older projects (before 2.5.8)
            graphicInterface.getGridSettings().setGridStyle(
                    GridStyle.NONE);
            graphicInterface.getGridSettings().setSnapEnabled(false);
        } else {
            graphicInterface.setGridSettings(gridSettings);
        }

        return graphicInterface;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("graphicInterface");

        retVal.setAttribute("editEnabled", Boolean.toString(editEnabled));

        retVal.addElement(gridSettings.saveAsXML());
        
        for (Iterator<BSBObject> iter = interfaceItems.iterator(); iter.hasNext();) {
            BSBObject bsbObj = iter.next();
            retVal.addElement(bsbObj.saveAsXML());
        }

        return retVal;
    }

    public void addBSBGraphicInterfaceListener(
            BSBGraphicInterfaceListener listener) {
        if (listeners == null) {
            listeners = new Vector<BSBGraphicInterfaceListener>();
        }

        listeners.add(listener);
    }

    public void removeBSBGraphicInterfaceListener(
            BSBGraphicInterfaceListener listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    public void fireBSBObjectAdded(BSBObject bsbObj) {
        if (listeners != null) {
            Iterator<BSBGraphicInterfaceListener> iter
                    = new Vector<BSBGraphicInterfaceListener>(listeners).iterator();

            while (iter.hasNext()) {
                BSBGraphicInterfaceListener listener = iter
                        .next();
                listener.bsbObjectAdded(bsbObj);
            }
        }
    }

    public void fireBSBObjectRemoved(BSBObject bsbObj) {
        if (listeners != null) {
            Iterator<BSBGraphicInterfaceListener> iter
                    = new Vector<BSBGraphicInterfaceListener>(listeners).iterator();

            while (iter.hasNext()) {
                BSBGraphicInterfaceListener listener = (BSBGraphicInterfaceListener) iter
                        .next();
                listener.bsbObjectRemoved(bsbObj);
            }
        }
    }

    public ArrayList<String> getNames() {
        ArrayList<String> names = new ArrayList<String>();

        for (int i = 0; i < size(); i++) {
            BSBObject bsbObj = getBSBObject(i);
            String[] replacementKeys = bsbObj.getReplacementKeys();

            if (replacementKeys != null) {
                names.addAll(Arrays.asList(replacementKeys));
            }
        }

        return names;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public boolean isEditEnabled() {
        return editEnabled;
    }

    public void setEditEnabled(boolean editEnabled) {
        this.editEnabled = editEnabled;
    }

    public GridSettings getGridSettings() {
        return gridSettings;
    }

    public void setGridSettings(GridSettings gridSettings) {
        this.gridSettings = gridSettings;
    }

    public void randomize() {
        for (int i = 0; i < size(); i++) {
            BSBObject bsbObj = getBSBObject(i);
            if (bsbObj instanceof Randomizable) {
                Randomizable randomizable = (Randomizable) bsbObj;
                if (randomizable.isRandomizable()) {
                    randomizable.randomize();
                }
            }
        }
    }
}
