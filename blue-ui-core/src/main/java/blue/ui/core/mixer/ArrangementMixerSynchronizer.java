package blue.ui.core.mixer;

import blue.Arrangement;
import blue.mixer.Channel;
import blue.mixer.ChannelList;
import blue.mixer.Mixer;
import java.util.ArrayList;

public final class ArrangementMixerSynchronizer {

    private ArrangementMixerSynchronizer() {
    }

    public static void synchronize(Mixer mixer, Arrangement arrangement) {
        if (mixer == null || arrangement == null) {
            return;
        }

        ChannelList channels = mixer.getChannels();
        ArrayList<String> arrangementIds = new ArrayList<>();

        for (int i = 0; i < arrangement.size(); i++) {
            String arrangementId = arrangement.getInstrumentAssignment(i).arrangementId;

            if (!arrangementIds.contains(arrangementId)) {
                arrangementIds.add(arrangementId);
            }
        }

        for (int i = channels.size() - 1; i >= 0; i--) {
            Channel channel = channels.get(i);
            if (!arrangementIds.contains(channel.getName())) {
                channels.remove(channel);
            }
        }

        for (String arrangementId : arrangementIds) {
            channels.checkOrCreate(arrangementId);
        }
    }

    public static void synchronizeInstrumentIdChange(Mixer mixer,
            Arrangement arrangement, String oldId, String newId) {
        if (mixer == null || arrangement == null || oldId == null || newId == null) {
            synchronize(mixer, arrangement);
            return;
        }

        ChannelList channels = mixer.getChannels();
        Channel oldChannel = findChannelByName(channels, oldId);
        Channel newChannel = findChannelByName(channels, newId);

        int oldIdCount = 0;
        int newIdCount = 0;

        for (int i = 0; i < arrangement.size(); i++) {
            String arrangementId = arrangement.getInstrumentAssignment(i).arrangementId;

            if (arrangementId.equals(oldId)) {
                oldIdCount++;
            } else if (arrangementId.equals(newId)) {
                newIdCount++;
            }
        }

        if (oldIdCount == 0 && newIdCount == 1) {
            if (oldChannel != null && newChannel == null) {
                oldChannel.setName(newId);
            } else {
                removeChannel(channels, oldChannel);
                if (newChannel == null) {
                    channels.checkOrCreate(newId);
                }
            }
        } else if (oldIdCount == 0 && newIdCount > 1) {
            removeChannel(channels, oldChannel);
        } else if (oldIdCount > 0 && newIdCount == 1 && newChannel == null) {
            channels.checkOrCreate(newId);
        }

        synchronize(mixer, arrangement);
    }

    private static Channel findChannelByName(ChannelList channels, String channelName) {
        if (channelName == null) {
            return null;
        }

        for (Channel channel : channels) {
            if (channelName.equals(channel.getName())) {
                return channel;
            }
        }

        return null;
    }

    private static void removeChannel(ChannelList channels, Channel channel) {
        if (channel != null) {
            channels.remove(channel);
        }
    }
}