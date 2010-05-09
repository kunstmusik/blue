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
package blue.orchestra.editor.blueSynthBuilder;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.beans.PropertyEditor;

import javax.swing.JButton;
import javax.swing.JPanel;

import blue.components.lines.LineList;

/**
 * @author steven
 */
public class LineListPropertyEditor implements PropertyEditor {

    private static LineListEditorDialog dialog;

    PropertyChangeSupport listeners = new PropertyChangeSupport(this);

    LineList items = null;

    BSBLineObjectView view = null;

    Component editor;

    JButton button;

    public LineListPropertyEditor() {
        editor = new JPanel(new BorderLayout(0, 0));

        ((JPanel) editor).add("East", button = new JButton("..."));
        button.setMargin(new Insets(0, 0, 0, 0));

        button.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                // selectColor();
                // JOptionPane.showMessageDialog(null, "test");
                editItems();
            }
        });

        ((JPanel) editor).setOpaque(false);
    }

    /**
     * This method is a hack to get the view updated
     */
    protected void editItems() {
        if (dialog == null) {
            dialog = new LineListEditorDialog();
            dialog.setModal(true);
        }

        LineList temp = new LineList();
        for (int i = 0; i < items.size(); i++) {
            temp.addLine(items.getLine(i));
        }

        dialog.setLineList(temp);
        boolean val = dialog.ask();

        if (val) {
            items = temp;
            view.setLineList(items);
        }

        // BSBDropdownItemList old = items;
        // BSBDropdownItemList newList = (BSBDropdownItemList) items.clone();
        // dialog.show(newList);
        //
        // listeners.firePropertyChange("value", old, newList);
        //
        // old.clear();
        // old.addAll(newList);

        // view.refresh();
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#getCustomEditor()
     */
    public Component getCustomEditor() {
        return editor;
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#supportsCustomEditor()
     */
    public boolean supportsCustomEditor() {
        return false;
    }

    public Object getValue() {
        return view;
    }

    public void setValue(Object value) {
        this.view = (BSBLineObjectView) value;
        this.items = view.getLineList();
    }

    public String getAsText() {
        return null;
    }

    public String getJavaInitializationString() {
        return null;
    }

    public String[] getTags() {
        return null;
    }

    public void setAsText(String text) throws IllegalArgumentException {
    }

    public void paintValue(Graphics gfx, Rectangle box) {

    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#isPaintable()
     */
    public boolean isPaintable() {
        return true;
    }

    public void addPropertyChangeListener(PropertyChangeListener listener) {
        listeners.addPropertyChangeListener(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        listeners.removePropertyChangeListener(listener);
    }

    protected void firePropertyChange(Object oldValue, Object newValue) {
        listeners.firePropertyChange("value", oldValue, newValue);
    }

}