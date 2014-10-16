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

package blue.mixer;

import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.ListModel;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * @author Steven Yi
 */
public class ChannelList implements ListModel, Serializable {

    ArrayList<Channel> channels = new ArrayList<Channel>();

    private transient Vector<ListDataListener> listeners = null;

    private transient Vector<ChannelListListener> channelListListeners = null;

    /** Creates a new instance of ChannelList */
    public ChannelList() {
    }

    public static ChannelList loadFromXML(Element data) throws Exception {
        ChannelList channels = new ChannelList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("channel")) {
                channels.addChannel(Channel.loadFromXML(node));
            }
        }

        return channels;
    }

    public Element saveAsXML() {
        Element retVal = new Element("channelList");

        for (Channel channel : channels) {
            retVal.addElement(channel.saveAsXML());
        }

        return retVal;
    }

    public Channel getChannel(int index) {
        return channels.get(index);
    }

    public void addChannel(Channel channel) {
        int index = channels.size();
        channels.add(channel);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_ADDED, index, index);

        fireListEvent(lde);

        fireChannelAdded(channel);
    }

    public void removeChannel(Channel channel) {
        int index = channels.indexOf(channel);

        if (index == -1) {
            return;
        }

        channels.remove(channel);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_REMOVED, index, index);

        fireListEvent(lde);
        fireChannelRemoved(channel);
    }

    public int size() {
        return channels.size();
    }

    // ListModel Methods

    public int getSize() {
        return size();
    }

    public Object getElementAt(int index) {
        return getChannel(index);
    }

    public void checkOrCreate(String channelName) {
        for (Iterator it = channels.iterator(); it.hasNext();) {
            Channel channel = (Channel) it.next();
            if (channel.getName().equals(channelName)) {
                return;
            }
        }
        Channel channel = new Channel();
        channel.setName(channelName);
        this.addChannel(channel);
    }

    public void sort() {
        Collections.<Channel>sort(channels);
    }

    public void addListDataListener(ListDataListener l) {
        if (listeners == null) {
            listeners = new Vector<ListDataListener>();
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

        for (Iterator<ListDataListener> it = listeners.iterator(); it.hasNext();) {
            ListDataListener listener = it.next();

            switch (lde.getType()) {
                case ListDataEvent.INTERVAL_ADDED:
                    listener.intervalAdded(lde);
                    break;
                case ListDataEvent.INTERVAL_REMOVED:
                    listener.intervalRemoved(lde);
                    break;
            }
        }
    }

    public int indexByName(Object anItem) {
        for (int i = 0; i < channels.size(); i++) {
            Channel channel = channels.get(i);
            if (channel.getName().equals(anItem)) {
                return i;
            }
        }

        return -1;
    }

    boolean contains(Channel channel) {
        return channels.contains(channel);
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public boolean isChannelNameInUse(String channelName) {
        for (int i = 0; i < size(); i++) {
            Channel c = getChannel(i);

            if (c.getName().equals(channelName)) {
                return true;
            }
        }
        return false;
    }

    public void addChannelListListener(ChannelListListener listener) {
        if (channelListListeners == null) {
            channelListListeners = new Vector<ChannelListListener>();
        }

        channelListListeners.add(listener);
    }

    public void removeChannelListListener(ChannelListListener listener) {
        if (channelListListeners != null) {
            channelListListeners.remove(listener);
        }
    }

    private void fireChannelAdded(Channel channel) {
        if (channelListListeners != null) {
            Iterator iter = new Vector(channelListListeners).iterator();

            while (iter.hasNext()) {
                ChannelListListener listener = (ChannelListListener) iter
                        .next();
                listener.channelAdded(channel);
            }
        }
    }

    private void fireChannelRemoved(Channel channel) {
        if (channelListListeners != null) {
            Iterator<ChannelListListener> iter =
                    new Vector<ChannelListListener>(channelListListeners).iterator();

            while (iter.hasNext()) {
                ChannelListListener listener = iter.next();
                listener.channelRemoved(channel);
            }
        }
    }

    public int indexOfChannel(String channelName) {
        for (int i = 0; i < channels.size(); i++) {
            if (getChannel(i).getName().equals(channelName)) {
                return i;
            }
        }

        return -1;
    }

    public void clearChannelsNotInList(ArrayList ids) {
        Iterator iter = channels.iterator();
        
        while(iter.hasNext()) {
            Channel channel = (Channel) iter.next();
            
            if(!ids.contains(channel.getName())) {
                iter.remove();
            }
        }
    }
}
