/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.library;

import blue.soundObject.SoundObject;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Function;

/**
 *
 * @author stevenyi
 */
public class Library<T extends SoundObject> {

    LibraryItem<T> root;

    static final Set<String> FOLDER_NAMES;

    static {
        FOLDER_NAMES = new HashSet<>();
        FOLDER_NAMES.add("instrumentCategory");
        FOLDER_NAMES.add("effectCategory");
        FOLDER_NAMES.add("udoCategory");
        FOLDER_NAMES.add("category");
    }

    public static <T extends SoundObject> Library<T> createLibrary(String rootName) {
        Library<T> lib = new Library<>();
        lib.root = new LibraryItem<T>(null, rootName);
        return lib;
    }

    public static <T extends SoundObject> Library<T> loadLibrary(Element elem,
            Function<Element, T> loader) {
        Library<T> lib = new Library<>();
        
        lib.root = loadLibraryItem(null, elem.getElement("category"), loader);
        return lib;
    }

    private static <T extends SoundObject> LibraryItem<T> loadLibraryItem(LibraryItem<T> parent, Element elem,
            Function<Element, T> loader) {
        
        LibraryItem<T> item;
        if (FOLDER_NAMES.contains(elem.getName())) {
            item = new LibraryItem<>(parent, elem.getAttributeValue("categoryName"));

            Elements children = elem.getElements();
            while (children.hasMoreElements()) {
                item.getChildren().add(loadLibraryItem(item, children.next(), loader));
            }
        } else {
            item = new LibraryItem<>(parent, loader.apply(elem));
        }

        return item;
    }

    public Element saveAsXML(Function<LibraryItem<T>, Element> saver) {
        Element retVal = new Element("soundObjectLibrary");
        retVal.addElement(saveAsXML(root, saver));
        return retVal;
    }

    private Element saveAsXML(LibraryItem<T> item,
            Function<LibraryItem<T>, Element> saver) {

        Element retVal;

        if(!item.isLeaf()) {
            retVal = new Element("category");
            retVal.setAttribute("categoryName", item.toString());

            for(var child : item.getChildren()) {
               retVal.addElement(saveAsXML(child, saver)); 
            }
            
        } else {
            retVal = saver.apply(item); 
        }

        return retVal;
    }

    public LibraryItem<T> getRoot() {
        return root;
    }

}
