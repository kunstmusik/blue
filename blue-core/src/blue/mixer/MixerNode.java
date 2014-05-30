package blue.mixer;

import blue.CompileData;
import blue.automation.Parameter;
import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import blue.utility.MusicFunctions;
import blue.utility.NumberUtilities;
import java.util.*;
import org.apache.commons.lang3.text.StrBuilder;

/**
 * A Mixer's channels and subchannels are translated to a MixerNode graph that
 * represents to the toplogy of the channels and subChannels as a tree
 * structure.
 * 
 * Child nodes represent sources to the current node. Within childNodes, the
 * order is important and represents the interdependency from Sends. Channel
 * nodes must be first as they are the earliest sources of signals into the
 * graph. SubChannel childNodes come next. Ultimately all signals from
 * SubChannel children feed into the current node. Since they may send signals
 * to each other, they must be sorted so that their signals are process in the
 * correct order.
 * 
 * Because SubChannelOutComboBox limits the user to only feedforward without
 * feedback loops and all channels must have an outChannel, certain assumptions
 * are encoded into the graph.
 * 
 */

class MixerNode {

    public String name;

    public Channel channel;

    public List<MixerNode> children = new ArrayList<>();

    public boolean generatesOutSignal = true;

    public boolean outChannelValid = true;

    public int lastPreFaderSendIndex = -1;

    public int lastPostFaderSendIndex = -1;

    public List<String> outChannelNames = null;

    @Override
    public String toString() {
        return str(0);
    }

    private String str(int depth) {
        StrBuilder retVal = new StrBuilder();

        for (int i = 0; i < depth; i++) {
            retVal.append(" ");
        }

        retVal.append(name).append("\n");

        for (MixerNode m : children) {
            retVal.append(m.str(depth + 2));
        }

        return retVal.toString();
    }

    /**
     * Generates Csound Instrument for Mixer. Effects are added as UDO's to
     * project. Code generations for Channels and SubChannels is optimized to
     * not generate unnecessary code by following rules:
     * 
     * <ol>
     * 
     * <li>if channel does not generate signal to channel output (if no
     * automation for level fader and fader == -96.0f), only generate code up to
     * last send in preFader effects chain</li>
     * 
     * <li> when processing Sends, checks down the graph to see if send signal
     * will make it to the Master output or not, checking both down graph of
     * output channels as well as sends for each channel. If not, does not
     * generate output for Send. </li>
     * 
     * <li> if channel does not have channel output and no valid prefader sends,
     * do not generate anything </li>
     * </ol>
     * 
     * @param mixer
     * @param udos
     * @param manager
     * @param node
     * @param nchnls
     * @return
     */

    public static String getMixerCode(CompileData data, Mixer mixer, OpcodeList udos,
            EffectManager manager, MixerNode mixerNode, int nchnls) {

        StrBuilder buffer = new StrBuilder();

        List<MixerNode> nodes = new ArrayList<>();
        flattenToList(mixerNode, nodes);
        MixerNode.sortNodesList(nodes);

        Set<String> inputSignalCache = new HashSet<>();

        for (int i = 0; i < nodes.size(); i++) {
            MixerNode tempNode = nodes.get(i);

            // Check if subChannel has no sources and do not generate
            // anything if not
            if (mixer.isSubChannel(tempNode.channel)
                    && !mixer.hasSubChannelDependency(tempNode.name)
                    && !inputSignalCache.contains(tempNode.name)) {
                continue;
            }

            // get signal string

            String signalChannels = "";

            for (int j = 0; j < nchnls; j++) {
                if (j == 0) {
                    signalChannels = mixer.getVar(data, tempNode.channel, j);
                } else {
                    signalChannels += ", " + mixer.getVar(data, tempNode.channel, j);
                }

            }

            // apply pre-fader effects

            EffectsChain preEffects = tempNode.channel.getPreEffects();

            int lastIndex = Integer.MAX_VALUE;

            if (!tempNode.generatesOutSignal) {
                lastIndex = tempNode.lastPreFaderSendIndex;

                if (lastIndex < 0) {
                    continue; // skip as no sends and fader zeros signal
                }
            }

            applyEffects(preEffects, udos, manager, signalChannels, buffer,
                    lastIndex, inputSignalCache);

            // stop processing here if fader will kill signal
            if (tempNode.generatesOutSignal) {

                // apply fader value
                applyFader(data, mixer, tempNode, nchnls, buffer);

                // apply post-fader effects

                EffectsChain postEffects = tempNode.channel.getPostEffects();

                lastIndex = Integer.MAX_VALUE;

                if (!tempNode.outChannelValid) {
                    lastIndex = tempNode.lastPostFaderSendIndex;

                    if (lastIndex < 0) {
                        continue; // skip as no sends and no out channel
                        // signal
                    }
                }

                applyEffects(postEffects, udos, manager, signalChannels,
                        buffer, lastIndex, inputSignalCache);

                // mix into out channel

                if (tempNode.outChannelValid && i != nodes.size() - 1) {

                    String outChannelName = tempNode.channel.getOutChannel();

                    inputSignalCache.add(outChannelName);

                    for (int j = 0; j < nchnls; j++) {
                        String channelVar = mixer.getVar(data, tempNode.channel, j);
                        String outChannelVar = Mixer.getSubChannelVar(
                                outChannelName, j);

                        buffer.append(outChannelVar).append("\tsum\t");
                        buffer.append(outChannelVar).append(", ");
                        buffer.append(channelVar).append("\n");
                    }

                }

            }
        }

        return buffer.toString();
    }

    protected static void sortNodesList(List<MixerNode> nodes) {
        /* Master Node always at end, so start with one previous */
        int topIndex = nodes.size() - 2;

        while (topIndex >= 1) {
            int newIndex = topIndex;

            MixerNode temp = nodes.get(topIndex);

            for (int i = newIndex - 1; i >= 0; i--) {
                MixerNode temp2 = nodes.get(i);

                if (temp.getOutChannelNames().contains(temp2.name)) {
                    newIndex = i;
                }
            }

            if (newIndex == topIndex) {
                topIndex -= 1;
            } else {
                nodes.remove(temp);
                nodes.add(newIndex, temp);
            }

        }
    }

    /**
     * Depth first flattening of MixerNode tree structure to ArrayList. Should
     * be sorted in correct order from getMixerGraph(mixer).
     * 
     * @param node
     * @param channels
     */
    protected static void flattenToList(MixerNode node, List<MixerNode> channels) {
        flattenToList(node, channels, 0);
    }

    private static void flattenToList(MixerNode node, List<MixerNode> channels,
            int depthCount) {
        for (MixerNode child : node.children) { 

            if (child.children.size() > 0) {
                flattenToList(child, channels, depthCount + 1);
            }
        }

        for (MixerNode child : node.children) { 
            channels.add(child);
        }

        if (depthCount == 0) {
            channels.add(node);
        }
    }

    /**
     * Walks down all subchannels to find if it ends up at Master, either
     * through output channels or sends.
     * 
     * @param channelName
     * @param subChannelCache
     * @return
     */
    protected static boolean isValidOut(String channelName,
            Map<String, Channel> subChannelCache) {
        if (channelName.equals(Channel.MASTER)) {
            return true;
        }

        Channel channel = subChannelCache.get(channelName);

        Send[] sends = channel.getPreFaderSends();

        for (Send send : sends) {
            if (isValidOut(send.getSendChannel(), subChannelCache)) {
                return true;
            }
        }

        if (hasOutSignal(channel)) {

            Send[] postSends = channel.getPostFaderSends();

            for (Send postSend : postSends) {
                if (isValidOut(postSend.getSendChannel(), subChannelCache)) {
                    return true;
                }
            }

            if (isValidOut(channel.getOutChannel(), subChannelCache)) {
                return true;
            }
        }

        return false;
    }

    protected static int indexOfLastValidSend(EffectsChain chain,
            Map<String, Boolean> validOutCache) {

        int index = -1;

        for (int i = 0; i < chain.getSize(); i++) {
            Object obj = chain.getElementAt(i);

            if (obj instanceof Send) {
                Send send = (Send) obj;

                if (send.getSendChannel().equals(Channel.MASTER)) {
                    index = i;
                } else {

                    Boolean valid = validOutCache.get(send
                            .getSendChannel());
                    if (valid) {
                        index = i;
                    }
                }
            }
        }

        return index;
    }

    private static void applyFader(CompileData data, Mixer mixer, MixerNode node, int nchnls,
            StrBuilder buffer) {
        String modifier = null;

        Parameter levelParam = node.channel.getLevelParameter();
        String compilationVarName = levelParam.getCompilationVarName();
        
        if (levelParam.isAutomationEnabled()) {
            if (compilationVarName != null) {

                buffer.append("ktempdb = ampdb(");
                buffer.append(compilationVarName).append(")\n");

                modifier = "ktempdb";
            }
        } else {
            float multiplier = (float) MusicFunctions.ampdb(node.channel
                    .getLevel());
            
            if(compilationVarName != null) {
                buffer.append("ktempdb = ampdb(");
                buffer.append(compilationVarName).append(")\n");

                modifier = "ktempdb";                
            } else {
                if (multiplier != 1.0f) {
                    modifier = getMultiplierString(multiplier);
                }
            }
            
        }

        if (modifier != null) {
            for (int i = 0; i < nchnls; i++) {
                String sig = mixer.getVar(data, node.channel, i);
                buffer.append(sig).append(" = ");
                buffer.append(sig).append(" * ");
                buffer.append(modifier).append("\n");
            }
        }
    }

    private static void applyEffects(EffectsChain chain, OpcodeList udos,
            EffectManager manager, String signalChannels, StrBuilder buffer,
            final int lastSendIndex, Set<String> inputSignalCache) {

        int lastIndex = lastSendIndex;

        if (lastIndex == Integer.MAX_VALUE) {
            lastIndex = chain.size() - 1;
        } else if (lastIndex < 0) {
            return;
        }

        for (int i = 0; i <= lastIndex; i++) {
            Object obj = chain.getElementAt(i);

            if (obj instanceof Effect) {
                Effect effect = (Effect) obj;

                if (effect.isEnabled()) {

                    UserDefinedOpcode udo = effect.generateUDO(udos);

                    String effectName = udos.getNameOfEquivalentCopy(udo);

                    if (effectName == null) {
                        effectName = manager.getEffectName();

                        udo.opcodeName = effectName;

                        udos.addOpcode(udo);
                    }

                    buffer.append(signalChannels).append("\t");
                    buffer.append(effectName).append("\t");
                    buffer.append(signalChannels).append("\n");
                }
            } else if (obj instanceof Send) {
                Send send = (Send) obj;

                if (send.isEnabled()) {
                    String[] parts = signalChannels.split(",");
                    String sendChannelName = send.getSendChannel();

                    inputSignalCache.add(sendChannelName);

                    for (int j = 0; j < parts.length; j++) {

                        String subVar = Mixer.getSubChannelVar(sendChannelName,
                                j);

                        buffer.append(subVar).append("\tsum\t").append(subVar);
                        buffer.append(", ");

                        Parameter levelParam = send.getLevelParameter();

                        if (levelParam.isAutomationEnabled()) {
                            String compilationVarName = levelParam
                                    .getCompilationVarName();

                            buffer.append("(").append(parts[j].trim()).append(
                                    " * ");
                            buffer.append(compilationVarName).append(")\n");
                        } else if (send.getLevel() == 1.0f) {
                            buffer.append(parts[j].trim()).append("\n");
                        } else {

                            String levelStr = NumberUtilities.formatFloat(send
                                    .getLevel());

                            buffer.append("(").append(parts[j].trim()).append(
                                    " * ");
                            buffer.append(levelStr).append(")\n");
                        }
                    }
                }
            }

        }
    }

    private static String getMultiplierString(float multiplier) {
        return NumberUtilities.formatFloat(multiplier);
    }

    private static void configureNode(MixerNode node, Map<String, Boolean> validOutCache) {

        boolean hasOutSignal = hasOutSignal(node.channel);

        node.lastPreFaderSendIndex = indexOfLastValidSend(node.channel
                .getPreEffects(), validOutCache);

        node.lastPostFaderSendIndex = indexOfLastValidSend(node.channel
                .getPostEffects(), validOutCache);

        node.generatesOutSignal = hasOutSignal;

        node.outChannelValid = true;

        String outChannel = node.channel.getOutChannel();

        if (outChannel.equals(Channel.MASTER)) {
            node.outChannelValid = true;
        } else {
            Boolean valid = validOutCache.get(outChannel);
            if (valid == null) {
                System.err.println("ERROR: " + node.channel.getName() + " : "
                        + outChannel);
            }
            node.outChannelValid = valid.booleanValue();
        }
    }

    private static boolean hasOutSignal(Channel channel) {
        Parameter levelParam = channel.getLevelParameter();
        float level = channel.getLevel();

        boolean hasOutSignal = (levelParam.isAutomationEnabled() || (level > -96.0f));
        return hasOutSignal;
    }

    /**
     * Compiles down mixer into tree graph representation of MixerNodes. Child
     * nodes represent channel output dependency. Because the mixer graph is
     * feedforward only and that the mixer graph is generated depth first, the
     * only requirement for correctly handling Sends is sorting SubChannel
     * children nodes to make sure that they are processed in the correct order.
     * 
     * @param mixer
     * @return rootNode
     */
    public static MixerNode getMixerGraph(Mixer mixer) {
        MixerNode masterNode = new MixerNode();
        masterNode.channel = mixer.getMaster();
        masterNode.name = Channel.MASTER;

        Map<String, Boolean> validOutCache = getValidOutCache(mixer);

        attachChildren(mixer, masterNode, validOutCache);

        return masterNode;
    }

    protected static Map<String, Boolean> getValidOutCache(Mixer mixer) {
        Map<String, Channel> subChannelCache = mixer.getSubChannelCache();

        Map<String, Boolean> validOutCache = new HashMap<>();

        for (int i = 0; i < mixer.getSubChannels().size(); i++) {
            Channel subChannel = mixer.getSubChannel(i);

            boolean valid = isValidOut(subChannel.getName(), subChannelCache);

            validOutCache.put(subChannel.getName(), valid);
        }

        return validOutCache;
    }

    private static void attachChildren(final Mixer mixer, MixerNode node,
            Map<String, Boolean> validOutCache) {
        for (Channel c : mixer.getAllSourceChannels()) {

            if (c.getOutChannel().equals(node.name)) {
                MixerNode m = new MixerNode();
                m.name = c.getName();
                m.channel = c;

                configureNode(m, validOutCache);

                node.children.add(m);

            }
        }

        List<MixerNode> temp = new ArrayList<>();

        for (Channel c : mixer.getSubChannels()) {

            if (c.getOutChannel().equals(node.name)) {
                MixerNode m = new MixerNode();
                m.name = c.getName();
                m.channel = c;

                configureNode(m, validOutCache);

                temp.add(m);

                attachChildren(mixer, m, validOutCache);
            }
        }

        if (temp.size() > 0) {
            Collections.sort(temp, new Comparator<MixerNode>() {
                @Override
                public int compare(MixerNode node1, MixerNode node2) {
                    if (mixer.sendsTo(node1.channel, node2.channel)) {
                        return -1;
                    } else if (mixer.sendsTo(node2.channel, node1.channel)) {
                        return 1;
                    }

                    return 0;
                }

            });

            node.children.addAll(temp);
        }

    }

    public List<String> getOutChannelNames() {
        if (outChannelNames == null) {
            outChannelNames = new ArrayList<>();

            Send[] preSends = this.channel.getPreFaderSends();

            for (Send preSend : preSends) {
                String sendName = preSend.getSendChannel();
                if (!outChannelNames.contains(sendName)) {
                    outChannelNames.add(sendName);
                }
            }

            if (generatesOutSignal) {
                Send[] postSends = this.channel.getPostFaderSends();

                for (Send postSend : postSends) {
                    String sendName = postSend.getSendChannel();
                    if (!outChannelNames.contains(sendName)) {
                        outChannelNames.add(sendName);
                    }
                }

                if (!outChannelNames.contains(this.channel.getOutChannel())) {
                    outChannelNames.add(this.channel.getOutChannel());
                }
            }
        }
        return outChannelNames;
    }
}
