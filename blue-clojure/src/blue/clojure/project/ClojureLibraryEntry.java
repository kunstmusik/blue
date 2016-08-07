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
import java.io.Externalizable;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;
import javafx.beans.InvalidationListener;
import javafx.beans.Observable;
import javafx.beans.property.SimpleStringProperty;

/**
 *
 * @author stevenyi
 */
public class ClojureLibraryEntry implements BlueDataObject, Externalizable {
    private SimpleStringProperty dependencyCoordinates;
    private SimpleStringProperty version;

    public ClojureLibraryEntry() {
       dependencyCoordinates = new SimpleStringProperty(this, "coordinates", 
       "org/library-name");
       version = new SimpleStringProperty(this, "version", "1.0.0");
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
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeUTF(getDependencyCoordinates());
        out.writeUTF(getVersion());
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        setDependencyCoordinates(in.readUTF());
        setVersion(in.readUTF());
    }
}
