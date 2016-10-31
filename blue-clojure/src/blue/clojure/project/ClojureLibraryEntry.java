/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.clojure.project;

import blue.BlueDataObject;
import electric.xml.Element;
import electric.xml.Elements;
import javafx.beans.property.SimpleStringProperty;

/**
 *
 * @author stevenyi
 */
public class ClojureLibraryEntry implements BlueDataObject {

    private SimpleStringProperty dependencyCoordinates
            = new SimpleStringProperty(this, "coordinates", "org/library-name");
    ;
    private SimpleStringProperty version = new SimpleStringProperty(this, "version", "1.0.0");

    public ClojureLibraryEntry() {
    }

    public ClojureLibraryEntry(ClojureLibraryEntry cle) {
        setDependencyCoordinates(cle.getDependencyCoordinates());
        setVersion(cle.getVersion());
    }

    public String getDependencyCoordinates() {
        return dependencyCoordinates.get();
    }

    public void setDependencyCoordinates(String coordinates) {
        dependencyCoordinates.set(coordinates);
    }

    public SimpleStringProperty dependencyCoordinates() {
        return dependencyCoordinates;
    }

    public String getVersion() {
        return version.get();
    }

    public void setVersion(String versionString) {
        version.set(versionString);
    }

    public SimpleStringProperty version() {
        return version;
    }

    public static ClojureLibraryEntry loadFromXML(Element data) {
        ClojureLibraryEntry lib = new ClojureLibraryEntry();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            final Element node = nodes.next();
            final String nodeText = node.getTextString();

            switch (node.getName()) {
                case "coordinates":
                    lib.setDependencyCoordinates(nodeText);
                    break;
                case "version":
                    lib.setVersion(nodeText);
                    break;
            }
        }

        return lib;
    }

    @Override
    public Element saveAsXML() {
        Element elem = new Element("clojureLibraryEntry");
        elem.addElement("coordinates").setText(getDependencyCoordinates());
        elem.addElement("version").setText(getVersion());

        return elem;
    }

    @Override
    public ClojureLibraryEntry deepCopy() {
        return new ClojureLibraryEntry(this);
    }
}
