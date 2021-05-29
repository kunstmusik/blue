/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import blue.CompileData;
import blue.orchestra.GenericInstrument;
import blue.udo.OpcodeList;
import blue.utility.ObjectUtilities;
import blue.util.ObservableArrayList;
import blue.util.ObservableList;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.text.StrBuilder;

/**
 * TODO - need to create dependency graph, then do depth first crawl to create
 * audio mix signals
 *
 *
 * @author Steven Yi
 */
public class Mixer {

    private static final MessageFormat GA_VAR = new MessageFormat(
            "ga_bluemix_{0}_{1}");

    private static final MessageFormat SUBMIX_VAR = new MessageFormat(
            "ga_bluesub_{0}_{1}");

    public static final String MASTER_CHANNEL = "Master";

    private final ObservableList<ChannelList> channelListGroups =
            new ObservableArrayList<>();

    private ChannelList channels = new ChannelList();

    private ChannelList subChannels = new ChannelList();

    private Channel master = new Channel();

    private boolean enabled = false;

    private double extraRenderTime = 0.0f;

    private transient Map<String, String> subChannelDependencies = null;

    public Mixer() {
        channels = new ChannelList();
        subChannels = new ChannelList();
        master = new Channel();

        master.setName(MASTER_CHANNEL);
        channels.setListName("Orchestra");
        subChannels.setListName("SubChannels");
    }

    public Mixer(Mixer mixer) {
        channels = new ChannelList(mixer.channels);
        subChannels = new ChannelList(mixer.subChannels);
        master = new Channel(mixer.master);

        for(ChannelList chanList : mixer.channelListGroups) {
            channelListGroups.add(new ChannelList(chanList));
        }

        enabled = mixer.enabled;
        extraRenderTime = mixer.extraRenderTime;
    }

    public static Mixer loadFromXML(Element data) throws Exception {
        Mixer mixer = new Mixer();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "enabled":
                    mixer.setEnabled(XMLUtilities.readBoolean(node));
                    break;
                case "extraRenderTime":
                    mixer.setExtraRenderTime(XMLUtilities.readDouble(node));
                    break;
                case "channelList":
                    String listType = node.getAttributeValue("list");
                    switch (listType) {
                        case "channels":
                            mixer.setChannels(ChannelList.loadFromXML(node));
                            mixer.getChannels().setListName("Orchestra");
                            mixer.getChannels().setListNameEditSupported(false);
                            break;
                        case "subChannels":
                            mixer.setSubChannels(ChannelList.loadFromXML(node));
                            mixer.getSubChannels().setListName("SubChannels");
                            mixer.getSubChannels().setListNameEditSupported(false);
                            break;
                    }
                    break;
                case "channelListGroups":

                    Elements listGroupsNodes = node.getElements();
                    while (listGroupsNodes.hasMoreElements()) {
                        mixer.channelListGroups.add(ChannelList.loadFromXML(
                                listGroupsNodes.next()));
                    }

                    break;
                case "channel":
                    mixer.setMaster(Channel.loadFromXML(node));
                    break;
            }

        }

        return mixer;
    }

    public Element saveAsXML() {
        Element retVal = new Element("mixer");

        retVal.addElement(XMLUtilities.writeBoolean("enabled", isEnabled()));
        retVal.addElement(XMLUtilities.writeDouble("extraRenderTime",
                extraRenderTime));

        if (channelListGroups.size() > 0) {
            Element groupsNode = new Element("channelListGroups");
            retVal.addElement(groupsNode);
            for (ChannelList list : channelListGroups) {
                groupsNode.addElement(list.saveAsXML());
            }
        }

        Element channelsNode = channels.saveAsXML();
        channelsNode.setAttribute("list", "channels");
        retVal.addElement(channelsNode);

        Element subChannelsNode = subChannels.saveAsXML();
        subChannelsNode.setAttribute("list", "subChannels");
        retVal.addElement(subChannelsNode);

        retVal.addElement(master.saveAsXML());

        return retVal;
    }

    public ObservableList<ChannelList> getChannelListGroups() {
        return channelListGroups;
    }

    public Channel getChannel(int index) {
        return channels.get(index);
    }

    public List<Channel> getAllSourceChannels() {
        List<Channel> allChannels = new ArrayList<>();

        for (ChannelList list : channelListGroups) {
            allChannels.addAll(list);
        }
        allChannels.addAll(channels);

        return allChannels;
    }
    
    public List<Channel> getAllChannels() {
        List<Channel> allChannels = new ArrayList<>();

        for (ChannelList list : channelListGroups) {
            allChannels.addAll(list);
        }
        allChannels.addAll(channels);
        
        allChannels.addAll(subChannels);
        allChannels.add(master);

        return allChannels;
    }
    
    
    
    
    public Channel findChannelById(String id) {
        if (id == null) return null;
        
        for (ChannelList list : channelListGroups) {
            for(Channel c : list) {
                if(id.equals(c.getAssociation())) {
                   return c;
                }
            }
        }
        return null;
    }

    public ChannelList getChannels() {
        return channels;
    }

    public Channel getSubChannel(int index) {
        return subChannels.get(index);
    }

    public ChannelList getSubChannels() {
        return subChannels;
    }

    public Channel getMaster() {
        return master;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public static String getChannelVar(int blueChannelId, int channel) {
        return GA_VAR
                .format(new Object[]{
                    new Integer(blueChannelId), 
                    new Integer(channel)});
    }

    public static String getSubChannelVar(String subChannelName, int channel) {
        return SUBMIX_VAR.format(new Object[]{
            subChannelName,
            new Integer(channel)});
    }

    public String getVar(CompileData data, Channel c, int channel) {
        String retVal;

        String name = c.getName();

        if (isChannel(c)) {
            retVal = getChannelVar(data.getChannelIdAssignments().get(c), channel);
        } else {
            retVal = getSubChannelVar(name, channel);
        }

        return retVal.replaceAll(" ", "");
    }

    public String getInitStatements(CompileData data, int nchnls) {
        StrBuilder buffer = new StrBuilder();

        List<Channel> allChannels = getAllSourceChannels();

        for (Channel c : allChannels) {

            for (int j = 0; j < nchnls; j++) {

                buffer.append(getChannelVar(data.getChannelIdAssignments().get(c), j)).append(
                        "\tinit\t0\n");
            }
        }

        for (int i = 0; i < subChannels.size(); i++) {
            Channel c = subChannels.get(i);

            for (int j = 0; j < nchnls; j++) {
                buffer.append(getSubChannelVar(c.getName(), j)).append(
                        "\tinit\t0\n");
            }
        }

        for (int j = 0; j < nchnls; j++) {
            buffer.append(getSubChannelVar(MASTER_CHANNEL, j)).append(
                    "\tinit\t0\n");
        }

        return buffer.toString();
    }

    public String getClearStatements(CompileData data, int nchnls) {
        StrBuilder buffer = new StrBuilder();

        List<Channel> allChannels = getAllSourceChannels();
        for (Channel c : allChannels) {
            for (int j = 0; j < nchnls; j++) {

                buffer.append(getChannelVar(
                        data.getChannelIdAssignments().get(c), j)).append(" = 0\n");
            }
        }

        for (Channel c : subChannels) {
            for (int j = 0; j < nchnls; j++) {

                buffer.append(getSubChannelVar(c.getName(), j))
                        .append(" = 0\n");
            }
        }

        for (int j = 0; j < nchnls; j++) {
            buffer.append(getSubChannelVar(MASTER_CHANNEL, j)).append(" = 0\n");
        }

        return buffer.toString();
    }

    public GenericInstrument getMixerInstrument(CompileData data, OpcodeList udos, int nchnls) {
        GenericInstrument instr = new GenericInstrument();
        instr.setName("Blue Mixer Instrument");

        StrBuilder buffer = new StrBuilder();

        MixerNode node = MixerNode.getMixerGraph(this);

        EffectManager manager = new EffectManager();

        buffer
                .append(MixerNode.getMixerCode(data, this, udos, manager, node,
                                nchnls));

        buffer.append("outc ");

        for (int i = 0; i < nchnls; i++) {
            if (i > 0) {
                buffer.append(", ");
            }
            buffer.append(getVar(data, master, i));
        }

        buffer.append("\n").append(getClearStatements(data, nchnls));

        instr.setText(buffer.toString());

        return instr;
    }

    public boolean isSubChannel(Channel channel) {
        return subChannels.contains(channel);
    }

    public boolean isChannel(Channel channel) {
        return getAllSourceChannels().contains(channel);
    }

    public void setChannels(ChannelList channels) {
        this.channels = channels;
    }

    public void setMaster(Channel master) {
        this.master = master;
    }

    public void setSubChannels(ChannelList subChannels) {
        this.subChannels = subChannels;
    }

    public double getExtraRenderTime() {
        return extraRenderTime;
    }

    public void setExtraRenderTime(double extraRenderTime) {
        this.extraRenderTime = extraRenderTime;
    }

    /**
     * Tells mixer that subchannel to act as if it has a dependency, used by
     * blueMixerOut when using subchannel form of calling.
     *
     * @param subChannelName
     */
    public void addSubChannelDependency(String subChannelName) {
        if (subChannelDependencies == null) {
            subChannelDependencies = new HashMap<>();
        }
        subChannelDependencies.put(subChannelName, subChannelName);
    }

    public boolean hasSubChannelDependency(String subChannelName) {
        if (subChannelDependencies == null) {
            return false;
        }
        return subChannelDependencies.containsKey(subChannelName);
    }

    public boolean hasSubChannelDependencies() {
        if (subChannelDependencies == null) {
            return false;
        }
        return subChannelDependencies.size() > 0;
    }

    /**
     * Checks if subChannelName1 depends on subChannelName2 by checking sends
     * and outChannel
     */
    public boolean sendsTo(Channel subChannel1, Channel subChannel2) {
        Send[] sends = subChannel1.getSends();
        String target = subChannel2.getName();

        for (int i = 0; i < sends.length; i++) {
            String channelName = sends[i].getSendChannel();

            if (channelName.equals(Channel.MASTER)) {
                continue;
            } else if (channelName.equals(target)) {
                return true;
            } else {
                if (sendsTo(getSubChannelByName(channelName), subChannel2)) {
                    return true;
                }
            }
        }

        return false;

    }

    private Channel getSubChannelByName(String name) {
        for (int i = 0; i < subChannels.size(); i++) {
            Channel c = subChannels.get(i);
            if (c.getName().equals(name)) {
                return c;
            }
        }
        return null;
    }

    public Map<String, Channel> getSubChannelCache() {
        Map<String, Channel> subChannelCache = new HashMap<>();

        for (int i = 0; i < getSubChannels().size(); i++) {
            Channel subChannel = getSubChannel(i);

            subChannelCache.put(subChannel.getName(), subChannel);
        }
        return subChannelCache;
    }

    
    
    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}
