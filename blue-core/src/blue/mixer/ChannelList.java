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
package blue.mixer;

import blue.util.ObservableArrayList;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.HashCodeBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * @author Steven Yi
 */
public class ChannelList extends ObservableArrayList<Channel>
        implements Serializable {

    /**
     * UniqueId of object that is associated with ChannelList (i.e.
     * AudioLayerGroup)
     */
    private String association = null;

    private String listName = "";
    private boolean listNameEditSupported = true;
    
    private PropertyChangeSupport propSupport = new PropertyChangeSupport(this);
    /**
     * Creates a new instance of ChannelList
     */
    public ChannelList() {
    }

    public String getListName() {
        return listName;
    }

    public void setListName(String listName) {
        if(!listNameEditSupported) {
            throw new RuntimeException("Error: Attempted to edit Channel List name for "
                    + "group that does not support it.");
        }
        String oldListName = this.listName;
        this.listName = listName;
        propSupport.firePropertyChange("listName", oldListName, listName);
    }

    public boolean isListNameEditSupported() {
        return listNameEditSupported;
    }

    public void setListNameEditSupported(boolean listNameEditSupported) {
        this.listNameEditSupported = listNameEditSupported;
    }
    
    

    public static ChannelList loadFromXML(Element data) throws Exception {
        ChannelList channels = new ChannelList();

        Elements nodes = data.getElements();

        String associationVal = data.getAttributeValue("association");
        if (associationVal != null && !"null".equals(associationVal)) {
            channels.setAssociation(data.getAttributeValue("association"));
        }
        
        String listName = data.getAttributeValue("listName");
        if(listName != null && !"null".equals(listName)) {
            channels.setListName(listName);
        }

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("channel")) {
                channels.add(Channel.loadFromXML(node));
            }
        }

        return channels;
    }

    public Element saveAsXML() {
        Element retVal = new Element("channelList");

        if (association != null) {
            retVal.setAttribute("association", association);
        }
        
        if (listName != null) {
            retVal.setAttribute("listName", listName);
        }

        for (Channel channel : this) {
            retVal.addElement(channel.saveAsXML());
        }

        return retVal;
    }

    public String getAssociation() {
        return association;
    }

    public void setAssociation(String association) {
        this.association = association;
    }


    public void checkOrCreate(String channelName) {
        for(Channel channel : this) {
            if (channel.getName().equals(channelName)) {
                return;
            }
        }
        Channel channel = new Channel();
        channel.setName(channelName);
        add(channel);
    }

    public void sort() {
        Collections.<Channel>sort(this);
    }

    public int indexByName(Object anItem) {
        for (int i = 0; i < size(); i++) {
            Channel channel = get(i);
            if (channel.getName().equals(anItem)) {
                return i;
            }
        }

        return -1;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public boolean isChannelNameInUse(String channelName) {
        for (Channel c : this) {
            if (c.getName().equals(channelName)) {
                return true;
            }
        }
        return false;
    }

    public int indexOfChannel(String channelName) {
        for (int i = 0; i < size(); i++) {
            if (get(i).getName().equals(channelName)) {
                return i;
            }
        }

        return -1;
    }

    public void clearChannelsNotInList(ArrayList ids) {
        Iterator<Channel> iter = this.iterator();

        while (iter.hasNext()) {
            Channel channel = iter.next();

            if (!ids.contains(channel.getName())) {
                iter.remove();
            }
        }
    }

    @Override
    public int hashCode() {
        return HashCodeBuilder.reflectionHashCode(11, 41, this, false);
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj, false);
    }
    
    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        propSupport.addPropertyChangeListener(pcl);
    }
    
    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        propSupport.removePropertyChangeListener(pcl);
    }
}
