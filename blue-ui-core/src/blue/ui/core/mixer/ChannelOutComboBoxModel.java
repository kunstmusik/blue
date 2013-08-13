/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.mixer;

import blue.mixer.*;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.ComboBoxModel;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

/**
 * 
 * @author steven
 */
public class ChannelOutComboBoxModel implements ComboBoxModel, ListDataListener {

    ChannelList channels = null;

    String selectedItem = null;

    Vector listeners = null;

    private Vector copies = null;

    /** Creates a new instance of ChannelOutComboBox */
    public ChannelOutComboBoxModel() {
    }

    public void setChannels(ChannelList channels) {
        if (this.channels != null) {
            this.channels.removeListDataListener(this);
        }

        this.channels = channels;

        this.channels.addListDataListener(this);
    }

    public void clearListeners() {
        this.channels.removeListDataListener(this);
        this.channels = null;
    }

    @Override
    public void setSelectedItem(Object anItem) {

        if (Channel.MASTER.equals(anItem)) {
            selectedItem = Channel.MASTER;
        } else {
            int index = channels.indexByName(anItem);

            if (index < 0) {
                selectedItem = Channel.MASTER;
            } else {
                selectedItem = (String) anItem;
            }

        }

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, -1, -1);

        fireListEvent(lde);
    }

    @Override
    public Object getSelectedItem() {
        return selectedItem;
    }

    @Override
    public int getSize() {
        if (channels == null) {
            return 1;
        }

        return channels.size() + 1;
    }

    @Override
    public Object getElementAt(int index) {
        if (index == 0) {
            return Channel.MASTER;
        }

        if (channels == null) {
            return null;
        }
        return channels.getChannel(index - 1).getName();
    }

    @Override
    public void addListDataListener(ListDataListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

    @Override
    public void removeListDataListener(ListDataListener l) {
        if (listeners == null) {
            return;
        }
        listeners.remove(l);
    }

    private void fireListEvent(ListDataEvent lde) {
        if (listeners == null) {
            return;
        }

        for (Iterator it = listeners.iterator(); it.hasNext();) {
            ListDataListener listener = (ListDataListener) it.next();

            switch (lde.getType()) {
                case ListDataEvent.INTERVAL_ADDED:
                    listener.intervalAdded(lde);
                    break;
                case ListDataEvent.INTERVAL_REMOVED:
                    listener.intervalRemoved(lde);
                    break;
                case ListDataEvent.CONTENTS_CHANGED:
                    listener.contentsChanged(lde);
                    break;
            }
        }
    }

    @Override
    public void intervalAdded(ListDataEvent e) {
        // System.out.println("channelOutComboBoxModel::intervalAdded()");
        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, -1, -1);

        fireListEvent(lde);
    }

    @Override
    public void intervalRemoved(ListDataEvent e) {
        if (channels.indexByName(selectedItem) < 0) {
            setSelectedItem(Channel.MASTER);
        }
    }

    @Override
    public void contentsChanged(ListDataEvent e) {
        System.out.println("channelOutComboBoxModel::contentsChanged()");
    }

    public void reconcile(String oldName, String newName) {
        if (this.getSelectedItem().toString().equals(oldName)) {
            setSelectedItem(newName);
        }

        if (copies != null) {
            for (int i = 0; i < copies.size(); i++) {
                ((ChannelOutComboBoxModel) copies.get(i)).reconcile(oldName,
                        newName);
            }
        }
    }

    public ChannelOutComboBoxModel getCopy() {
        ChannelOutComboBoxModel copy = new ChannelOutComboBoxModel();
        copy.setChannels(this.channels);

        if (copies == null) {
            copies = new Vector();
        }

        copies.add(copy);

        return copy;
    }

}
