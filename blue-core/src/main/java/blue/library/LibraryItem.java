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
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

/**
 *
 * @author stevenyi
 */
public class LibraryItem<T extends SoundObject> {

    private ObservableList<LibraryItem<T>> children;
    private String displayName = null;
    private T value = null;
    
    PropertyChangeSupport propertyChangeSupport = new PropertyChangeSupport(this);
    private LibraryItem<T> parent;

    /** Constructor for folder items **/
    public LibraryItem(LibraryItem<T> parent, String displayName) {
        children = FXCollections.observableArrayList();
        this.displayName = displayName;
        this.parent = parent;
    }

    /** Constructor for leaf items */
    public LibraryItem(LibraryItem<T> parent, T value) {
        this.parent = parent;
        children = null;
        this.value = value;
    }
    
    public LibraryItem<T> getParent() {
        return parent;
    }
    
    public ObservableList<LibraryItem<T>> getChildren() {
        return children;
    }
    
    public boolean isLeaf() {
        return value != null; 
    }

    @Override
    public String toString() {
        if (value != null) {
            return value.getName();
        }
        return displayName;
    }

    public T getValue() {
        return value;
    }

    public void setText(String textVal) {
        var oldName = toString();
        
        if(value == null){
            displayName = textVal;
        } else {
            value.setName(textVal);
        }
        propertyChangeSupport.firePropertyChange("displayName", oldName, textVal);
    }
    
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        propertyChangeSupport.addPropertyChangeListener(listener);
    }
    
    public void removePropertyChangeListener(PropertyChangeListener listener) {
        propertyChangeSupport.removePropertyChangeListener(listener);
    }

    public LibraryItem<T> deepCopy() {
        return this.deepCopy(this.parent);
    }
    
    public LibraryItem<T> deepCopy(LibraryItem<T> parent) {
        LibraryItem<T> clone;
        if(isLeaf()) {
            clone = new LibraryItem<T>(parent, (T)getValue().deepCopy());
        } else {
            clone = new LibraryItem<>(parent, this.displayName);
            
            for(var child : getChildren()) {
                clone.getChildren().add(child.deepCopy(clone));
            }
        }
        return clone;
    }
}
