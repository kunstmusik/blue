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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBDropdown;
import blue.orchestra.blueSynthBuilder.BSBDropdownItem;
import blue.ui.utilities.UiUtilities;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.EventListener;
import javafx.beans.InvalidationListener;
import javafx.beans.value.ChangeListener;
import javax.swing.ComboBoxModel;
import javax.swing.JComboBox;
import javax.swing.event.EventListenerList;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

/**
 * @author Steven Yi
 */
public class BSBDropdownView extends BSBObjectView<BSBDropdown> {

    private final DropdownComboBoxModel model = new DropdownComboBoxModel();

    private final JComboBox<BSBDropdownItem> comboBox;

    private final ActionListener updateIndexListener;

    private final ChangeListener<? super Number> indexListener;

    private final InvalidationListener listListener;

    private boolean updating = false;

    // FIXME: font size, width handling
    public BSBDropdownView(BSBDropdown dropdown) {
        super(dropdown);
        updating = true;

        

        this.setLayout(new BorderLayout());

        model.setDropDown(dropdown);

        comboBox = new JComboBox<>(model);

        this.add(comboBox, BorderLayout.CENTER);

        comboBox.setSize(comboBox.getPreferredSize());
        this.setSize(comboBox.getPreferredSize());

        int index = dropdown.getSelectedIndex();
        if (index < dropdown.dropdownItemsProperty().size()) {
            comboBox.setSelectedIndex(index);
        }

        this.updateIndexListener = (ActionEvent e) -> {
            if (!updating) {
                dropdown.setSelectedIndex(comboBox.getSelectedIndex());
            }
        };

        this.indexListener = (obs, old, newVal) -> {
            if (!updating) {
                updating = true;

                try {
                    UiUtilities.invokeOnSwingThread(() -> {
                        comboBox.setSelectedIndex(newVal.intValue());
                    });
                } finally {
                    updating = false;
                }

            }
        };

        this.listListener = o -> {
            model.refresh();
        };

        comboBox.addActionListener(updateIndexListener);

        updating = false;

        revalidate();

    }

    @Override
    public void addNotify() {
        super.addNotify();
        getBSBObject().selectedIndexProperty().addListener(indexListener);
        getBSBObject().dropdownItemsProperty().addListener(listListener);
    }

    @Override

    public void removeNotify() {
        super.removeNotify();
        getBSBObject().selectedIndexProperty().removeListener(indexListener);
        getBSBObject().dropdownItemsProperty().removeListener(listListener);
    }

}

class DropdownComboBoxModel implements ComboBoxModel<BSBDropdownItem> {

    EventListenerList listeners = new EventListenerList();

    BSBDropdown dropdown;

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ComboBoxModel#getSelectedItem()
     */
    @Override
    public BSBDropdownItem getSelectedItem() {
        if (dropdown == null || dropdown.dropdownItemsProperty().size() == 0) {
            return null;
        }

        int index = dropdown.getSelectedIndex();

        return dropdown.dropdownItemsProperty().get(index);

    }

    public void refresh() {
        int size = dropdown.dropdownItemsProperty().size();
        int selectedIndex = dropdown.getSelectedIndex();

        if (selectedIndex >= size) {
            dropdown.setSelectedIndex(size - 1);
        }

        if (size > 0 && selectedIndex < 0) {
            dropdown.setSelectedIndex(0);
        }

        EventListener[] eventListeners = listeners
                .getListeners(ListDataListener.class);

        ListDataEvent e = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, 0, dropdown.dropdownItemsProperty()
                        .size());

        for (int i = 0; i < eventListeners.length; i++) {
            ((ListDataListener) eventListeners[i]).contentsChanged(e);
        }
    }

    /**
     * @param dropdownItems2
     */
    public void setDropDown(BSBDropdown dropdown) {
        this.dropdown = dropdown;

        EventListener[] eventListeners = listeners
                .getListeners(ListDataListener.class);

        ListDataEvent e = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, 0, dropdown.dropdownItemsProperty()
                        .size());

        for (int i = 0; i < eventListeners.length; i++) {
            ((ListDataListener) eventListeners[i]).contentsChanged(e);
        }
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ComboBoxModel#setSelectedItem(java.lang.Object)
     */
    @Override
    public void setSelectedItem(Object anItem) {
        if (dropdown == null) {
            return;
        }

        int index = dropdown.dropdownItemsProperty().indexOf(anItem);
        dropdown.setSelectedIndex(index);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#getSize()
     */
    @Override
    public int getSize() {
        if (dropdown == null) {
            return 0;
        }
        return dropdown.dropdownItemsProperty().size();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#getElementAt(int)
     */
    @Override
    public BSBDropdownItem getElementAt(int index) {
        if (dropdown == null) {
            return null;
        }
        return dropdown.dropdownItemsProperty().get(index);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#addListDataListener(javax.swing.event.ListDataListener)
     */
    @Override
    public void addListDataListener(ListDataListener l) {
        listeners.add(ListDataListener.class, l);

    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#removeListDataListener(javax.swing.event.ListDataListener)
     */
    @Override
    public void removeListDataListener(ListDataListener l) {
        listeners.remove(ListDataListener.class, l);
    }

}
