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

import blue.mixer.Channel;
import blue.mixer.ChannelListListener;
import blue.mixer.Mixer;
import blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown;
import blue.projects.BlueProjectManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javafx.beans.value.ChangeListener;
import javax.swing.ComboBoxModel;
import javax.swing.JComboBox;
import javax.swing.ToolTipManager;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

/**
 * @author Steven Yi
 */
public class BSBSubChannelDropdownView extends BSBObjectView<BSBSubChannelDropdown> {

    SubChannelComboBoxModel model;
    JComboBox comboBox;
    ActionListener updateIndexListener;
    boolean updating = false;
    private ChangeListener<String> channelListener;

    public BSBSubChannelDropdownView(BSBSubChannelDropdown dropdown) {
        super(dropdown);

        this.setLayout(null);

        model = new SubChannelComboBoxModel();
        comboBox = new JComboBox(model) {
            @Override
            public String getToolTipText() {
                return shouldShowToolTip() ? bsbObj.getComment() : null;
            }
        };

        comboBox.setSelectedItem(dropdown.getChannelOutput());

        this.add(comboBox);

        comboBox.setSize(comboBox.getPreferredSize());
        this.setSize(comboBox.getPreferredSize());

        comboBox.addActionListener((ActionEvent e) -> {
            if (!updating) {
                dropdown.setChannelOutput((String) comboBox
                        .getSelectedItem());
            }
        });

        revalidate();

        channelListener = (obs, old, newVal) -> {
            updating = true;
            comboBox.setSelectedItem(newVal);
            updating = false;
        };

    }

    @Override
    public void addNotify() {
        super.addNotify();

        bsbObj.channelOutputProperty().addListener(channelListener);

        ToolTipManager.sharedInstance().registerComponent(comboBox);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        bsbObj.channelOutputProperty().removeListener(channelListener);

        ToolTipManager.sharedInstance().unregisterComponent(comboBox);
    }

}

class SubChannelComboBoxModel implements ComboBoxModel, ChannelListListener {

    List<ListDataListener> listeners = Collections.synchronizedList(
            new ArrayList<ListDataListener>());
    Mixer mixer;
    Object selected = null;

    public SubChannelComboBoxModel() {
        this.mixer = BlueProjectManager.getInstance().getCurrentBlueData().getMixer();

        // this.mixer.getSubChannels().addChannelListListener(this);
    }

    public void clearListeners() {
        // this.mixer.getSubChannels().removeChannelListListener(this);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ComboBoxModel#getSelectedItem()
     */
    @Override
    public Object getSelectedItem() {
        return selected;

    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ComboBoxModel#setSelectedItem(java.lang.Object)
     */
    @Override
    public void setSelectedItem(Object anItem) {
        this.selected = anItem;

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, -1, -1);

        fireListDataEvent(lde);

    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#getSize()
     */
    @Override
    public int getSize() {
        return mixer.getSubChannels().size() + 1;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#getElementAt(int)
     */
    @Override
    public Object getElementAt(int index) {
        if (index == 0) {
            return Channel.MASTER;
        }

        return mixer.getSubChannel(index - 1).getName();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#addListDataListener(javax.swing.event.ListDataListener)
     */
    @Override
    public void addListDataListener(ListDataListener l) {
        listeners.add(l);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.ListModel#removeListDataListener(javax.swing.event.ListDataListener)
     */
    @Override
    public void removeListDataListener(ListDataListener l) {
        listeners.remove(l);
    }

    @Override
    public void channelAdded(Channel channel) {
    }

    @Override
    public void channelRemoved(Channel channel) {
        if (!Channel.MASTER.equals(selected)) {
            if (mixer.getSubChannels().indexOfChannel((String) selected) < 0) {
                setSelectedItem(Channel.MASTER);
            }
        }
    }

    private void fireListDataEvent(ListDataEvent lde) {
        synchronized (listeners) {
            for (ListDataListener ldl : listeners) {
                ldl.contentsChanged(lde);
            }
        }
    }
}
