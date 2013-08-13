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

import blue.components.lines.LineList;
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

            @Override
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
    @Override
    public Component getCustomEditor() {
        return editor;
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyEditor#supportsCustomEditor()
     */
    @Override
    public boolean supportsCustomEditor() {
        return false;
    }

    @Override
    public Object getValue() {
        return view;
    }

    @Override
    public void setValue(Object value) {
        this.view = (BSBLineObjectView) value;
        this.items = view.getLineList();
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
        return true;
    }

    @Override
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        listeners.addPropertyChangeListener(listener);
    }

    @Override
    public void removePropertyChangeListener(PropertyChangeListener listener) {
        listeners.removePropertyChangeListener(listener);
    }

    protected void firePropertyChange(Object oldValue, Object newValue) {
        listeners.firePropertyChange("value", oldValue, newValue);
    }

}