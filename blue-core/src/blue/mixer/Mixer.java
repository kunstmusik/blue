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

import java.io.Serializable;
import java.text.MessageFormat;
import java.util.HashMap;

import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.text.StrBuilder;

import blue.orchestra.GenericInstrument;
import blue.udo.OpcodeList;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * TODO - need to create dependency graph, then do depth first crawl to create
 * audio mix signals
 * 
 * 
 * @author Steven Yi
 */

public class Mixer implements Serializable {

    private static final MessageFormat GA_VAR = new MessageFormat(
            "ga_bluemix_{0}_{1}");

    private static final MessageFormat SUBMIX_VAR = new MessageFormat(
            "ga_bluesub_{0}_{1}");

    public static final String MASTER_CHANNEL = "Master";

    private ChannelList channels = new ChannelList();

    private ChannelList subChannels = new ChannelList();

    private Channel master = new Channel();

    private boolean enabled = false;

    private float extraRenderTime = 0.0f;

    private transient HashMap<String, String> subChannelDependencies = null;

    public Mixer() {
        master.setName(MASTER_CHANNEL);
    }

    public static Mixer loadFromXML(Element data) throws Exception {
        Mixer mixer = new Mixer();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("enabled")) {
                mixer.setEnabled(XMLUtilities.readBoolean(node));
            } else if (nodeName.equals("extraRenderTime")) {
                mixer.setExtraRenderTime(XMLUtilities.readFloat(node));
            } else if (nodeName.equals("channelList")) {
                String listType = node.getAttributeValue("list");

                if (listType.equals("channels")) {
                    mixer.setChannels(ChannelList.loadFromXML(node));
                } else if (listType.equals("subChannels")) {
                    mixer.setSubChannels(ChannelList.loadFromXML(node));
                }

            } else if (nodeName.equals("channel")) {
                mixer.setMaster(Channel.loadFromXML(node));
            }

        }

        return mixer;
    }

    public Element saveAsXML() {
        Element retVal = new Element("mixer");

        retVal.addElement(XMLUtilities.writeBoolean("enabled", isEnabled()));
        retVal.addElement(XMLUtilities.writeFloat("extraRenderTime",
                extraRenderTime));

        Element channelsNode = channels.saveAsXML();
        channelsNode.setAttribute("list", "channels");
        retVal.addElement(channelsNode);

        Element subChannelsNode = subChannels.saveAsXML();
        subChannelsNode.setAttribute("list", "subChannels");
        retVal.addElement(subChannelsNode);

        retVal.addElement(master.saveAsXML());

        return retVal;
    }

    public Channel getChannel(int index) {
        return channels.getChannel(index);
    }

    public ChannelList getChannels() {
        return channels;
    }

    public Channel getSubChannel(int index) {
        return subChannels.getChannel(index);
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

    public static String getChannelVar(String channelName, int channel) {
        return GA_VAR
                .format(new Object[] { channelName, new Integer(channel) });
    }

    public static String getSubChannelVar(String channelName, int channel) {
        return SUBMIX_VAR.format(new Object[] { channelName,
                new Integer(channel) });
    }

    public String getVar(Channel c, int channel) {
        String retVal;

        String name = c.getName();

        if (isChannel(c)) {
            retVal = getChannelVar(name, channel);
        } else {
            retVal = getSubChannelVar(name, channel);
        }

        return retVal.replaceAll(" ", "");
    }

    public String getInitStatements(int nchnls) {
        StrBuilder buffer = new StrBuilder();

        for (int i = 0; i < channels.size(); i++) {
            Channel c = channels.getChannel(i);

            for (int j = 0; j < nchnls; j++) {

                buffer.append(getChannelVar(c.getName(), j)).append(
                        "\tinit\t0\n");
            }
        }

        for (int i = 0; i < subChannels.size(); i++) {
            Channel c = subChannels.getChannel(i);

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

    public String getClearStatements(int nchnls) {
        StrBuilder buffer = new StrBuilder();

        for (int i = 0; i < channels.size(); i++) {
            Channel c = channels.getChannel(i);

            for (int j = 0; j < nchnls; j++) {

                buffer.append(getChannelVar(c.getName(), j)).append(" = 0\n");
            }
        }

        for (int i = 0; i < subChannels.size(); i++) {
            Channel c = subChannels.getChannel(i);

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

    public GenericInstrument getMixerInstrument(OpcodeList udos, int nchnls) {
        GenericInstrument instr = new GenericInstrument();
        instr.setName("Blue Mixer Instrument");

        StrBuilder buffer = new StrBuilder();

        MixerNode node = MixerNode.getMixerGraph(this);

        EffectManager manager = new EffectManager();

        buffer
                .append(MixerNode.getMixerCode(this, udos, manager, node,
                        nchnls));

        buffer.append("outc ");

        for (int i = 0; i < nchnls; i++) {
            if (i > 0) {
                buffer.append(", ");
            }
            buffer.append(getVar(master, i));
        }

        buffer.append("\n").append(getClearStatements(nchnls));

        instr.setText(buffer.toString());

        return instr;
    }

    public Send[] getAllSends() {
        Send[] allSends = new Send[0];

        for (int i = 0; i < this.getSubChannels().size(); i++) {
            Channel c = this.getSubChannels().getChannel(i);

            Send[] sends = c.getSends();

            if (sends.length == 0) {
                continue;
            }

            Send[] temp = new Send[allSends.length + sends.length];
            System.arraycopy(allSends, 0, temp, 0, allSends.length);
            System.arraycopy(sends, 0, temp, allSends.length, sends.length);
            allSends = temp;
        }

        for (int i = 0; i < this.getChannels().size(); i++) {
            Channel c = this.getChannels().getChannel(i);
            Send[] sends = c.getSends();

            if (sends.length == 0) {
                continue;
            }

            Send[] temp = new Send[allSends.length + sends.length];
            System.arraycopy(allSends, 0, temp, 0, allSends.length);
            System.arraycopy(sends, 0, temp, allSends.length, sends.length);
            allSends = temp;
        }

        return allSends;
    }

    public boolean isSubChannel(Channel channel) {
        return subChannels.contains(channel);
    }

    public boolean isChannel(Channel channel) {
        return channels.contains(channel);
    }

//    public static void main(String args[]) {
//        Mixer mixer = new Mixer();
//
//        for (int i = 0; i < 5; i++) {
//            Channel c = new Channel();
//            c.setName("SubChannel " + (i + 1));
//            c.setLevel(0.3f);
//
//            mixer.getSubChannels().addChannel(c);
//        }
//
//        for (int i = 0; i < 10; i++) {
//            Channel c = new Channel();
//            c.setName(Integer.toString(i + 1));
//            c.setLevel(0.9f);
//
//            int outNum = (int) (Math.random() * 6);
//
//            if (outNum == 5) {
//                c.setOutChannel(Channel.MASTER);
//            } else {
//                c.setOutChannel(mixer.getSubChannels().getChannel(outNum)
//                        .getName());
//            }
//
//            mixer.getChannels().addChannel(c);
//        }
//
//        System.out.println(mixer.getInitStatements(2));
//
//        System.out.println("\n\n=================================\n\n");
//
//        System.out.println(mixer.getMixerInstrument(new OpcodeList(), 2)
//                .generateInstrument());
//
//    }

    public void setChannels(ChannelList channels) {
        this.channels = channels;
    }

    public void setMaster(Channel master) {
        this.master = master;
    }

    public void setSubChannels(ChannelList subChannels) {
        this.subChannels = subChannels;
    }

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public float getExtraRenderTime() {
        return extraRenderTime;
    }

    public void setExtraRenderTime(float extraRenderTime) {
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
            subChannelDependencies = new HashMap<String,String>();
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
            Channel c = subChannels.getChannel(i);
            if (c.getName().equals(name)) {
                return c;
            }
        }
        return null;
    }

    public HashMap<String, Channel> getSubChannelCache() {
        HashMap<String, Channel> subChannelCache = new HashMap<String, Channel>();

        for (int i = 0; i < getSubChannels().size(); i++) {
            Channel subChannel = getSubChannel(i);

            subChannelCache.put(subChannel.getName(), subChannel);
        }
        return subChannelCache;
    }
    
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}
