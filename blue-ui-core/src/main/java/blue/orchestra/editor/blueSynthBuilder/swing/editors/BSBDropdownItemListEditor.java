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
package blue.orchestra.editor.blueSynthBuilder.swing.editors;

import blue.orchestra.blueSynthBuilder.BSBDropdown;
import blue.orchestra.blueSynthBuilder.BSBDropdownItemList;
import blue.orchestra.editor.blueSynthBuilder.swing.BSBDropdownView;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.beans.PropertyEditor;
import javax.swing.JButton;
import javax.swing.JPanel;

/**
 * @author steven
 */
public class BSBDropdownItemListEditor implements PropertyEditor {

    PropertyChangeSupport listeners = new PropertyChangeSupport(this);

    BSBDropdownItemList items = null;

    public BSBDropdownItemListEditor() {
        
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#getCustomEditor()
     */
    @Override
    public Component getCustomEditor() {
        this.items = new BSBDropdownItemList(items);
        var editor = new DropdownItemEditorPanel(items);
        editor.table.getModel().addTableModelListener(tme -> {
            setValue(items);
        });
        return editor;
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#supportsCustomEditor()
     */
    @Override
    public boolean supportsCustomEditor() {
        return true;
    }

    @Override
    public Object getValue() {
        return items;
    }

    @Override
    public void setValue(Object value) {
        this.items = (BSBDropdownItemList) value;
        listeners.firePropertyChange("", null, null);
    }

    @Override
    public String getAsText() {
        return null;
    }

    @Override
    public String getJavaInitializationString() {
        return null;
    }

    @Override
    public String[] getTags() {
        return null;
    }

    @Override
    public void setAsText(String text) throws IllegalArgumentException {
    }

    @Override
    public void paintValue(Graphics gfx, Rectangle box) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#isPaintable()
     */
    @Override
    public boolean isPaintable() {
        return false;
    }

    @Override
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        listeners.addPropertyChangeListener(listener);
    }

    @Override
    public void removePropertyChangeListener(PropertyChangeListener listener) {
        listeners.removePropertyChangeListener(listener);
    }

}