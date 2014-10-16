/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.ComboBoxModel;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

/**
 * 
 * @author steven
 */
public class SubChannelOutComboBoxModel implements ComboBoxModel,
        ListDataListener {

    ChannelList channels = null;

    String selectedItem = null;

    Vector listeners = null;

    private Channel channel;

    private Vector copies = null;

    /** Creates a new instance of ChannelOutComboBox */
    public SubChannelOutComboBoxModel() {
    }

    public void setData(ChannelList subChannels, Channel c) {
        if (this.channels != null) {
            this.channels.removeListDataListener(this);
        }

        this.channels = subChannels;
        this.channel = c;

        this.channels.addListDataListener(this);
    }

    public void clearListeners() {
        this.channels.removeListDataListener(this);
        this.channels = null;
    }

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

    public Object getSelectedItem() {
        return selectedItem;
    }

    public int getSize() {
        return getReducedList().size();
    }

    public Object getElementAt(int index) {

        ArrayList choices = getReducedList();

        return choices.get(index);
    }

    private ArrayList getReducedList() {

        if (channels == null) {
            return null;
        }

        ArrayList retVal = new ArrayList();

        retVal.add(Channel.MASTER);

        for (int i = 0; i < channels.size(); i++) {
            Channel c = channels.getChannel(i);

            if (c == this.channel) {
                continue;
            }

            if (isPossibleOut(c, channel.getName())) {
                retVal.add(c.getName());
            }
        }

        // reduce(retVal, (String)selectedItem);

        return retVal;

    }

    private Channel getChannelByName(String name) {
        for (int i = 0; i < channels.size(); i++) {
            Channel c = channels.getChannel(i);
            if (c.getName().equals(name)) {
                return c;
            }
        }
        return null;
    }

    private boolean isPossibleOut(Channel c, String name) {
        if (c.getName().equals(name)) {
            return false;
        }

        Send[] sends = c.getSends();

        for (int i = 0; i < sends.length; i++) {
            if (sends[i].getSendChannel().equals(name)) {
                return false;
            }

            String sendChannelName = sends[i].getSendChannel();

            if (!sendChannelName.equals(Channel.MASTER)) {
                Channel next = getChannelByName(sendChannelName);

                if (!isPossibleOut(next, name)) {
                    return false;
                }
            }
        }

        String outChannel = c.getOutChannel();

        if (outChannel.equals(name)) {
            return false;
        }

        if (outChannel.equals(Channel.MASTER)) {
            return true;
        }

        Channel next = getChannelByName(outChannel);
        return isPossibleOut(next, name);
    }

    public void addListDataListener(ListDataListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

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

    public void intervalAdded(ListDataEvent e) {
        // System.out.println("channelOutComboBoxModel::intervalAdded()");
        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, -1, -1);

        fireListEvent(lde);

        if (copies != null) {
            for (int i = 0; i < copies.size(); i++) {
                ((SubChannelOutComboBoxModel) copies.get(i)).intervalAdded(e);
            }
        }
    }

    public void intervalRemoved(ListDataEvent e) {
        if (channels.indexByName(selectedItem) < 0) {
            setSelectedItem(Channel.MASTER);
        }
        if (copies != null) {
            for (int i = 0; i < copies.size(); i++) {
                ((SubChannelOutComboBoxModel) copies.get(i)).intervalRemoved(e);
            }
        }
    }

    public void contentsChanged(ListDataEvent e) {
        System.out.println("channelOutComboBoxModel::contentsChanged()");
    }

    public void reconcile(String oldName, String newName) {
        Object selected = this.getSelectedItem();

        if (selected == null || selected.toString().equals(oldName)) {
            setSelectedItem(newName);
        }

        if (copies != null) {
            for (int i = 0; i < copies.size(); i++) {
                ((SubChannelOutComboBoxModel) copies.get(i)).reconcile(oldName,
                        newName);
            }
        }
    }

    public ChannelList getChannels() {
        return channels;
    }

    public SubChannelOutComboBoxModel getCopy() {
        SubChannelOutComboBoxModel copy = new SubChannelOutComboBoxModel();
        copy.setData(this.channels, this.channel);

        if (copies == null) {
            copies = new Vector();
        }

        copies.add(copy);
        return copy;
    }
}
