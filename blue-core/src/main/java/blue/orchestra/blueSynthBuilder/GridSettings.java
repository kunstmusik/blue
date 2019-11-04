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
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;

/**
 *
 * @author stevenyi
 */
public class GridSettings {

    public static enum GridStyle {
        NONE, DOT, LINE
    }

    private IntegerProperty width = new SimpleIntegerProperty(10);
    private IntegerProperty height = new SimpleIntegerProperty(10);
    private ObjectProperty<GridStyle> gridStyle = new SimpleObjectProperty(GridStyle.DOT);
    private BooleanProperty snapEnabled = new SimpleBooleanProperty(true);

    public GridSettings() {
    }

    public GridSettings(GridSettings settings) {
        setWidth(settings.getWidth());
        setHeight(settings.getHeight());
        setGridStyle(settings.getGridStyle());
        setSnapEnabled(settings.isSnapEnabled());
    }

    public final void setWidth(int value) {
        width.set(value);
    }

    public final int getWidth() {
        return width.get();
    }

    public final IntegerProperty widthProperty() {
        return width;
    }

    public final void setHeight(int value) {
        height.set(value);
    }

    public final int getHeight() {
        return height.get();
    }

    public final IntegerProperty heightProperty() {
        return height;
    }

    public final void setSnapEnabled(boolean value) {
        snapEnabled.set(value);
    }

    public final boolean isSnapEnabled() {
        return snapEnabled.get();
    }

    public final BooleanProperty snapEnabledProperty() {
        return snapEnabled;
    }

    public final void setGridStyle(GridStyle gridStyle) {
        this.gridStyle.set(gridStyle);
    }

    public final GridStyle getGridStyle() {
        return gridStyle.get();
    }

    public final ObjectProperty<GridStyle> gridStyleProperty() {
        return gridStyle;
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
                    gridSettings.setWidth(XMLUtilities.readInt(node));
                    break;
                case "height":
                    gridSettings.setHeight(XMLUtilities.readInt(node));
                    break;
                case "gridStyle":
                    gridSettings.setGridStyle(GridStyle.valueOf(node.getTextString()));
                    break;
                case "snapGridEnabled":
                    gridSettings.setSnapEnabled(XMLUtilities.readBoolean(node));
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

        retVal.addElement(XMLUtilities.writeInt("width", getWidth()));
        retVal.addElement(XMLUtilities.writeInt("height", getHeight()));
        retVal.addElement(new Element("gridStyle").setText(getGridStyle().toString()));
        retVal.addElement(XMLUtilities.writeBoolean("snapGridEnabled",
                isSnapEnabled()));

        return retVal;
    }
}
