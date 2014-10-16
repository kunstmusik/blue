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
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.mixer;

import blue.udo.OpcodeList;
import java.util.ArrayList;
import java.util.HashMap;
import junit.framework.TestCase;

public class MixerNodeTest extends TestCase {
    public void testGetMixerGraph1() {
        Mixer mixer = new Mixer();

        Channel channel = new Channel();
        channel.setName("1");

        mixer.getChannels().addChannel(channel);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(1, node.children.size());
        MixerNode mixerNode = ((MixerNode) node.children.get(0));
        assertEquals(channel, mixerNode.channel);
        assertEquals("1", mixerNode.channel.getName());
    }

    public void testGetMixerGraphSubChannel() {
        Mixer mixer = new Mixer();

        Channel channel = new Channel();
        channel.setName("1");

        mixer.getChannels().addChannel(channel);

        Channel subChannel1 = new Channel();
        subChannel1.setName("subChannel1");

        mixer.getSubChannels().addChannel(subChannel1);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(2, node.children.size());
        MixerNode mixerNode = ((MixerNode) node.children.get(0));
        assertEquals(channel, mixerNode.channel);
        assertEquals("1", mixerNode.channel.getName());

        MixerNode mixerNode2 = ((MixerNode) node.children.get(1));
        assertEquals(subChannel1, mixerNode2.channel);
        assertEquals("subChannel1", mixerNode2.channel.getName());
    }

    public void testGetMixerGraphChildStructure() {
        Mixer mixer = new Mixer();

        Channel channel = new Channel();
        channel.setName("1");

        mixer.getChannels().addChannel(channel);

        Channel subChannel1 = new Channel();
        subChannel1.setName("subChannel1");

        mixer.getSubChannels().addChannel(subChannel1);

        Channel subChannel2 = new Channel();
        subChannel2.setName("subChannel2");

        mixer.getSubChannels().addChannel(subChannel2);

        // setting up routing
        channel.setOutChannel(subChannel1.getName());
        subChannel1.setOutChannel(subChannel2.getName());

        MixerNode node = MixerNode.getMixerGraph(mixer);
        assertEquals(Channel.MASTER, node.channel.getName());

        assertEquals(1, node.children.size());

        node = (MixerNode) node.children.get(0);

        assertEquals(1, node.children.size());
        assertEquals(subChannel2, node.channel);

        node = (MixerNode) node.children.get(0);

        assertEquals(1, node.children.size());
        assertEquals(subChannel1, node.channel);

        node = (MixerNode) node.children.get(0);

        assertEquals(0, node.children.size());
        assertEquals(channel, node.channel);
    }

    public void testGetMixerGraphChildStructure2() {
        Mixer mixer = new Mixer();

        // setup channels
        Channel channel = new Channel();
        channel.setName("1");

        mixer.getChannels().addChannel(channel);

        Channel channel2 = new Channel();
        channel2.setName("2");

        mixer.getChannels().addChannel(channel2);

        // setup subchannels
        Channel subChannel1 = new Channel();
        subChannel1.setName("subChannel1");

        mixer.getSubChannels().addChannel(subChannel1);

        Channel subChannel2 = new Channel();
        subChannel2.setName("subChannel2");

        mixer.getSubChannels().addChannel(subChannel2);

        // setting up routing
        channel.setOutChannel(subChannel1.getName());
        channel2.setOutChannel(subChannel2.getName());
        subChannel1.setOutChannel(subChannel2.getName());

        MixerNode node = MixerNode.getMixerGraph(mixer);
        assertEquals(Channel.MASTER, node.channel.getName());

        assertEquals(1, node.children.size());

        node = (MixerNode) node.children.get(0);

        assertEquals(2, node.children.size());
        assertEquals(subChannel2, node.channel);

        MixerNode node2 = (MixerNode) node.children.get(1);

        node = (MixerNode) node.children.get(0);

        assertEquals(0, node.children.size());
        assertEquals(channel2, node.channel);

        assertEquals(1, node2.children.size());
        assertEquals(subChannel1, node2.channel);

        node = (MixerNode) node2.children.get(0);

        assertEquals(0, node.children.size());
        assertEquals(channel, node.channel);
    }

    public void testGetMixerGraphSubChannelOrderFromSend() {
        Mixer mixer = new Mixer();

        Channel channel = new Channel();
        channel.setName("1");

        mixer.getChannels().addChannel(channel);

        Channel subChannel1 = new Channel();
        subChannel1.setName("subChannel1");

        mixer.getSubChannels().addChannel(subChannel1);

        Channel subChannel2 = new Channel();
        subChannel2.setName("subChannel2");

        Send send = new Send();
        send.setSendChannel("subChannel1");

        subChannel2.getPostEffects().addSend(send);

        mixer.getSubChannels().addChannel(subChannel2);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(3, node.children.size());

        MixerNode mixerNode2 = ((MixerNode) node.children.get(1));
        assertEquals(subChannel2, mixerNode2.channel);
        assertEquals("subChannel2", mixerNode2.channel.getName());

        MixerNode mixerNode3 = ((MixerNode) node.children.get(2));
        assertEquals(subChannel1, mixerNode3.channel);
        assertEquals("subChannel1", mixerNode3.channel.getName());
    }

    public void testIsValidOut() {
        Mixer mixer = getTestMixer(2, 2);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(4, node.children.size());

        HashMap subChannelCache = mixer.getSubChannelCache();

        assertTrue(MixerNode.isValidOut("subChannel1", subChannelCache));
        assertTrue(MixerNode.isValidOut("subChannel2", subChannelCache));
    }

    public void testIsValidOut2() {
        Mixer mixer = getTestMixer(2, 2);

        mixer.getSubChannel(0).setLevel(-96.0f);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(4, node.children.size());

        HashMap subChannelCache = mixer.getSubChannelCache();

        assertFalse(MixerNode.isValidOut("subChannel1", subChannelCache));
        assertTrue(MixerNode.isValidOut("subChannel2", subChannelCache));
    }

    public void testIsValidOut3() {
        Mixer mixer = getTestMixer(2, 2);

        mixer.getSubChannel(0).getPreEffects().addSend(new Send());
        mixer.getSubChannel(0).setLevel(-96.0f);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(4, node.children.size());

        HashMap subChannelCache = mixer.getSubChannelCache();

        assertTrue(MixerNode.isValidOut("subChannel1", subChannelCache));
        assertTrue(MixerNode.isValidOut("subChannel2", subChannelCache));
    }

    public void testIsValidOut4() {
        Mixer mixer = getTestMixer(2, 2);

        mixer.getSubChannel(0).setOutChannel("subChannel2");
        mixer.getSubChannel(1).setLevel(-96.0f);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(3, node.children.size());

        HashMap subChannelCache = mixer.getSubChannelCache();

        assertFalse(MixerNode.isValidOut("subChannel1", subChannelCache));
        assertFalse(MixerNode.isValidOut("subChannel2", subChannelCache));
    }

    public void testIsValidOut5() {
        Mixer mixer = getTestMixer(2, 3);

        Send send = new Send();
        send.setSendChannel("subChannel3");
        mixer.getSubChannel(0).setOutChannel("subChannel2");
        mixer.getSubChannel(0).getPreEffects().addSend(send);

        mixer.getSubChannel(1).setLevel(-96.0f);
        mixer.getSubChannel(2).setLevel(-96.0f);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        assertEquals(4, node.children.size());

        HashMap subChannelCache = mixer.getSubChannelCache();

        assertFalse(MixerNode.isValidOut("subChannel1", subChannelCache));
        assertFalse(MixerNode.isValidOut("subChannel2", subChannelCache));
        assertFalse(MixerNode.isValidOut("subChannel3", subChannelCache));
    }

    public void testGetMixerCode() {
        Mixer mixer = getTestMixer(1, 1);

        mixer.getChannel(0).setLevel(-96.0f);
        mixer.getSubChannel(0).setLevel(-96.0f);

        OpcodeList opcodeList = new OpcodeList();
        EffectManager manager = new EffectManager();
        int nchnls = 2;

        MixerNode node = MixerNode.getMixerGraph(mixer);
        Send[] allSends = mixer.getAllSends();

        String output = MixerNode.getMixerCode(mixer, opcodeList, manager,
                node, nchnls);

        assertEquals("", output);
    }

    /**
     * Should *not* output any signals (channel must look ahead when doing sends
     * to see if it will hit master or be a dead end)
     */
    public void testGetMixerCode2() {

        Send send = new Send();
        send.setSendChannel("subChannel1");

        Mixer mixer = getTestMixer(1, 1);
        mixer.getChannel(0).setLevel(-96.0f);
        mixer.getChannel(0).getPreEffects().addSend(send);
        mixer.getSubChannel(0).setLevel(-96.0f);

        OpcodeList opcodeList = new OpcodeList();
        EffectManager manager = new EffectManager();
        int nchnls = 2;

        MixerNode node = MixerNode.getMixerGraph(mixer);

        String out = MixerNode.getMixerCode(mixer, opcodeList, manager, node,
                nchnls);

        assertEquals("", out);
    }

    /**
     * Should output channel1->send->subChannel1->mixer; subchannel2 is dead end
     * 
     */
    public void testGetMixerCode3() {

        Send send = new Send();
        send.setSendChannel("subChannel1");

        Mixer mixer = getTestMixer(1, 2);
        mixer.getChannel(0).getPostEffects().addSend(send);
        mixer.getChannel(0).setOutChannel("subChannel2");

        mixer.getSubChannel(1).setLevel(-96.0f);

        OpcodeList opcodeList = new OpcodeList();
        EffectManager manager = new EffectManager();
        int nchnls = 2;

        MixerNode node = MixerNode.getMixerGraph(mixer);

        String out = MixerNode.getMixerCode(mixer, opcodeList, manager, node,
                nchnls);

        String expected = "ga_bluesub_subChannel1_0\tsum\tga_bluesub_subChannel1_0, ga_bluemix_1_0\n"
                + "ga_bluesub_subChannel1_1\tsum\tga_bluesub_subChannel1_1, ga_bluemix_1_1\n"
                + "ga_bluesub_Master_0\tsum\tga_bluesub_Master_0, ga_bluesub_subChannel1_0\n"
                + "ga_bluesub_Master_1\tsum\tga_bluesub_Master_1, ga_bluesub_subChannel1_1\n";

        assertEquals(expected, out);
    }

    public void testGetMixerCode4() {
        Mixer mixer = getTestMixer(3, 2);

        mixer.getChannel(1).setOutChannel("subChannel1");
        mixer.getChannel(2).setOutChannel("subChannel1");

        OpcodeList opcodeList = new OpcodeList();
        EffectManager manager = new EffectManager();
        int nchnls = 2;

        MixerNode node = MixerNode.getMixerGraph(mixer);

        String out = MixerNode.getMixerCode(mixer, opcodeList, manager, node,
                nchnls);

        String expected = "ga_bluesub_subChannel1_0\tsum\tga_bluesub_subChannel1_0, ga_bluemix_2_0\n"
                + "ga_bluesub_subChannel1_1\tsum\tga_bluesub_subChannel1_1, ga_bluemix_2_1\n"
                + "ga_bluesub_subChannel1_0\tsum\tga_bluesub_subChannel1_0, ga_bluemix_3_0\n"
                + "ga_bluesub_subChannel1_1\tsum\tga_bluesub_subChannel1_1, ga_bluemix_3_1\n"
                + "ga_bluesub_Master_0\tsum\tga_bluesub_Master_0, ga_bluemix_1_0\n"
                + "ga_bluesub_Master_1\tsum\tga_bluesub_Master_1, ga_bluemix_1_1\n"
                + "ga_bluesub_Master_0\tsum\tga_bluesub_Master_0, ga_bluesub_subChannel1_0\n"
                + "ga_bluesub_Master_1\tsum\tga_bluesub_Master_1, ga_bluesub_subChannel1_1\n";

        assertEquals(expected, out);
    }

    public void testFlatten() {
        Mixer mixer = getTestMixer(2, 2);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        ArrayList list = new ArrayList();
        MixerNode.flattenToList(node, list);

        assertEquals(5, list.size());
        assertEquals(node, list.get(4));
    }

    public void testFlatten2() {
        Send send = new Send();
        send.setSendChannel("subChannel1");

        Mixer mixer = getTestMixer(1, 2);
        mixer.getChannel(0).getPostEffects().addSend(send);
        mixer.getChannel(0).setOutChannel("subChannel2");

        mixer.getSubChannel(1).setLevel(-96.0f);

        MixerNode node = MixerNode.getMixerGraph(mixer);

        ArrayList list = new ArrayList();
        MixerNode.flattenToList(node, list);

        assertEquals("1", ((MixerNode) list.get(0)).channel.getName());
        assertEquals("subChannel1", ((MixerNode) list.get(1)).channel.getName());
        assertEquals("subChannel2", ((MixerNode) list.get(2)).channel.getName());
    }

    public void testFlatten3() {
        Send send2 = new Send();
        send2.setSendChannel("subChannel2");

        Send send3 = new Send();
        send3.setSendChannel("subChannel3");

        Mixer mixer = getTestMixer(1, 4);

        mixer.getSubChannel(0).getPreEffects().addSend(send2);
        mixer.getSubChannel(0).getPreEffects().addSend(send3);

        mixer.getSubChannel(1).setOutChannel("subChannel4");
        mixer.getSubChannel(2).setOutChannel("subChannel4");

        MixerNode node = MixerNode.getMixerGraph(mixer);

        ArrayList list = new ArrayList();
        MixerNode.flattenToList(node, list);
        MixerNode.sortNodesList(list);

        // for (Iterator iter = list.iterator(); iter.hasNext();) {
        // MixerNode element = (MixerNode) iter.next();
        //
        // System.out.println(element.name);
        // }

        assertEquals("subChannel1", ((MixerNode) list.get(0)).channel.getName());
        assertEquals("subChannel2", ((MixerNode) list.get(1)).channel.getName());
        assertEquals("subChannel3", ((MixerNode) list.get(2)).channel.getName());
        assertEquals("1", ((MixerNode) list.get(3)).channel.getName());
        assertEquals("subChannel4", ((MixerNode) list.get(4)).channel.getName());
    }

    private Mixer getTestMixer(int numChannels, int numSubChannels) {
        Mixer mixer = new Mixer();

        for (int i = 0; i < numChannels; i++) {
            Channel channel = new Channel();
            channel.setName(Integer.toString(i + 1));

            mixer.getChannels().addChannel(channel);
        }

        for (int i = 0; i < numSubChannels; i++) {
            Channel subChannel = new Channel();
            subChannel.setName("subChannel" + (i + 1));

            mixer.getSubChannels().addChannel(subChannel);
        }

        return mixer;
    }
}