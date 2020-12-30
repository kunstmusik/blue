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

import blue.orchestra.blueSynthBuilder.GridSettings.GridStyle;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.HashSet;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableSet;
import org.apache.commons.lang3.builder.EqualsBuilder;

/**
 * Stores BSBObjects, notification of changes used by BSBParameterList to keep
 * BSBParameters in sync with BSBObjects
 *
 * @author steven
 *
 */
public class BSBGraphicInterface {

    BSBGroup rootGroup;

    UniqueNameManager nameManager = new UniqueNameManager();

    private final BooleanProperty editEnabled = new SimpleBooleanProperty(true);

    private GridSettings gridSettings;

    private final ObservableSet<BSBObject> allSet
            = FXCollections.observableSet(new HashSet<>());

    public BSBGraphicInterface() {
        gridSettings = new GridSettings();
        nameManager.setDefaultPrefix("bsbObj");
        setRootGroup(new BSBGroup());
        rootGroup.setAllSet(allSet);

        nameManager.setUniqueNameCollection(rootGroup);
    }

    public BSBGraphicInterface(BSBGraphicInterface bsbInterface) {
        gridSettings = new GridSettings(bsbInterface.getGridSettings());
        nameManager.setDefaultPrefix("bsbObj");
        setRootGroup(new BSBGroup(bsbInterface.rootGroup));
        rootGroup.setAllSet(allSet);

        nameManager.setUniqueNameCollection(rootGroup);
        setEditEnabled(bsbInterface.isEditEnabled());
    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        rootGroup.setupForCompilation(compilationUnit);
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
                    BSBObject obj = (BSBObject) ObjectUtilities.loadFromXML(node);
                    if (obj instanceof BSBGroup) {
                        graphicInterface.setRootGroup((BSBGroup) obj);
                    } else {
                        // legacy reading of BSBObjects stored here pre-2.7.0
                        graphicInterface.getRootGroup().addBSBObject(obj);
                    }
                    break;
                case "gridSettings":
                    gridSettings = GridSettings.loadFromXML(node);
                    break;
            }
        }

        if (gridSettings == null) {
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

        retVal.setAttribute("editEnabled", Boolean.toString(isEditEnabled()));

        retVal.addElement(gridSettings.saveAsXML());
        retVal.addElement(rootGroup.saveAsXML());

        return retVal;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public final void setEditEnabled(boolean value) {
        editEnabled.set(value);
    }

    public final boolean isEditEnabled() {
        return editEnabled.get();
    }

    public final BooleanProperty editEnabledProperty() {
        return editEnabled;
    }

    public GridSettings getGridSettings() {
        return gridSettings;
    }

    public void setGridSettings(GridSettings gridSettings) {
        this.gridSettings = gridSettings;
    }

    public BSBGroup getRootGroup() {
        return rootGroup;
    }

    private void setRootGroup(BSBGroup group) {
        if(this.rootGroup != null) {
            this.rootGroup.setAllSet(null);
            this.allSet.clear();
        }
        this.rootGroup = group;
        group.setUniqueNameManager(nameManager);
        nameManager.setUniqueNameCollection(rootGroup);
        group.setAllSet(allSet);
    }

    public ObservableSet<BSBObject> getAllSet() {
        return allSet;
    }
}
