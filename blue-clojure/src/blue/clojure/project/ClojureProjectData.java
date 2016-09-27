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
import blue.project.ProjectPluginUtils;
import electric.xml.Element;
import electric.xml.Elements;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.collections.transformation.FilteredList;

/**
 *
 * @author stevenyi
 */
public class ClojureProjectData implements BlueDataObject {

    ObservableList<ClojureLibraryEntry> libraryList = 
            FXCollections.observableArrayList();

    public ClojureProjectData() {
    }

    public ClojureProjectData(ClojureProjectData cpd) {
        for(ClojureLibraryEntry lib : cpd.libraryList) {
            libraryList.add(new ClojureLibraryEntry(lib));
        }
    }

    public ObservableList<ClojureLibraryEntry> libraryList() {
        return libraryList;
    }

    public String getPomegranateString() {

        FilteredList<ClojureLibraryEntry> filtered = 
                libraryList.filtered(libEntry ->
                !libEntry.getDependencyCoordinates().isEmpty() &&
                        !libEntry.getVersion().isEmpty());

        if(filtered.size() == 0) {
            return null;
        }
        
       StringBuilder builder = new StringBuilder(); 

       builder.append("(use '[cemerick.pomegranate :only (add-dependencies)])\n");
      builder.append("(add-dependencies :coordinates '[");

      // [kunstmusik/score "0.3.0" :exclusions [org.clojure/clojure]]
      for(ClojureLibraryEntry lib : filtered) {
         builder.append("[").append(lib.getDependencyCoordinates()); 
         builder.append(" \"").append(lib.getVersion()).append("\" "); 
         builder.append(":exclusions [org.clojure/clojure]]\n"); 
      }
      
      builder.append("] :repositories (merge ");
      builder.append("cemerick.pomegranate.aether/maven-central ");
      builder.append("{\"clojars\" \"http://clojars.org/repo\"}))");

      return builder.toString();
    }


    /* SERIALIZATION CODE */

    public static ClojureProjectData loadFromXML(Element data) {

        ClojureProjectData projData = new ClojureProjectData();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            final Element node = nodes.next();
            projData.libraryList.add(ClojureLibraryEntry.loadFromXML(node));
        }

        return projData;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = ProjectPluginUtils.getBaseElement(this.getClass());

        for(ClojureLibraryEntry lib : libraryList) {
           retVal.addElement(lib.saveAsXML());
        }

        return retVal;
    }

    @Override
    public ClojureProjectData deepCopy() {
        return new ClojureProjectData(this);
    }
    
}
