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

import blue.orchestra.blueSynthBuilder.BSBDropdown;
import blue.orchestra.blueSynthBuilder.BSBDropdownItem;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.EventListener;
import javax.swing.ComboBoxModel;
import javax.swing.JComboBox;
import javax.swing.event.EventListenerList;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;


/**
 * @author Steven Yi
 */
public class BSBDropdownView extends AutomatableBSBObjectView implements
        PropertyChangeListener {

    BSBDropdown dropdown = null;

    DropdownComboBoxModel model = new DropdownComboBoxModel();

    JComboBox<BSBDropdownItem> comboBox;

    ActionListener updateIndexListener;

    private boolean updating = false;

    public BSBDropdownView(BSBDropdown dropdown) {
        updating = true;

        this.dropdown = dropdown;
        this.setBSBObject(dropdown);

        this.setLayout(null);

        model.setDropDown(dropdown);

        updateIndexListener = (ActionEvent e) -> {
            if (!updating) {
                updateSelectedIndex();
            }
        };

        setComboBox();

        updating = false;

        dropdown.addPropertyChangeListener(this);

        revalidate();

    }

    /**
     * @param dropdown
     */
    private void setComboBox() {
        if (this.comboBox != null) {
            this.remove(comboBox);
        }

        comboBox = new JComboBox<>(model);

        this.add(comboBox);

        comboBox.setSize(comboBox.getPreferredSize());
        this.setSize(comboBox.getPreferredSize());

        comboBox.addActionListener(updateIndexListener);

        int index = dropdown.getSelectedIndex();
        if (index < dropdown.getDropdownItems().size()) {
            comboBox.setSelectedIndex(index);
        }

    }

    /**
     * 
     */
    protected void updateSelectedIndex() {
        int index = comboBox.getSelectedIndex();
        dropdown.setSelectedIndex(index);
    }

    public BSBDropdownView getDropdownView() {
        return this;
    }

    public void setDropdownView(BSBDropdownView view) {

    }

    public void refresh() {
        model.refresh();

        setComboBox();
    }

    @Override
    public String toString() {
        return "";
    }

    public boolean isRandomizable() {
        return dropdown.isRandomizable();
    }

    public void setRandomizable(boolean randomizable) {
        dropdown.setRandomizable(randomizable);
    }

    @Override
    public void propertyChange(PropertyChangeEvent pce) {
        if (pce.getSource() == this.dropdown) {
            if (pce.getPropertyName().equals("selectedIndex")) {
                updating = true;

                int index = dropdown.getSelectedIndex();
                if (index < dropdown.getDropdownItems().size()) {
                    comboBox.setSelectedIndex(index);
                }

                updating = false;

                repaint();
            }
        }
    }

    @Override
    public void cleanup() {
        dropdown.removePropertyChangeListener(this);
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
        if (dropdown == null || dropdown.getDropdownItems().size() == 0) {
            return null;
        }

        int index = dropdown.getSelectedIndex();

        return dropdown.getDropdownItems().get(index);

    }

    public void refresh() {
        int size = dropdown.getDropdownItems().size();
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
                ListDataEvent.CONTENTS_CHANGED, 0, dropdown.getDropdownItems()
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
                ListDataEvent.CONTENTS_CHANGED, 0, dropdown.getDropdownItems()
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

        int index = dropdown.getDropdownItems().indexOf(anItem);
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
        return dropdown.getDropdownItems().size();
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
        return dropdown.getDropdownItems().get(index);
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