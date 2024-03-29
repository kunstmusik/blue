/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.settings;

import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 *
 * @author syi
 */
public class PlaybackSettings {

    private static final String PREFIX = "playback.";
    private static final String PLAYBACK_FPS = "playbackFPS";
    private static final String PLAYBACK_LATENCY_CORRECTION = "playbackLatencyCorrection";
    private static final String FOLLOW_PLAYBACK = "followPlayback";
    private static final String FOLLOW_PLAYBACK_ON_START = "followPlaybackOnStart";
    
    private int playbackFPS;
    private float playbackLatencyCorrection;
    private boolean followPlayback;
    private boolean followPlaybackOnStart;
    private static PlaybackSettings instance = null;

    private PlaybackSettings() {
    }

    public static Preferences getPreferences() {
        return NbPreferences.forModule(PlaybackSettings.class);
    }
    
    public static PlaybackSettings getInstance() {
        if (instance == null) {
            instance = new PlaybackSettings();

            final Preferences prefs = getPreferences();

            instance.playbackFPS = prefs.getInt(PREFIX + PLAYBACK_FPS, 24);
            instance.playbackLatencyCorrection =
                    prefs.getFloat(PREFIX + PLAYBACK_LATENCY_CORRECTION, 0.00f);
            instance.followPlayback =
                    prefs.getBoolean(PREFIX + FOLLOW_PLAYBACK, true);
            instance.followPlaybackOnStart =
                    prefs.getBoolean(PREFIX + FOLLOW_PLAYBACK_ON_START, true);
        }

        return instance;
    }

    public void save() {
        final Preferences prefs = getPreferences();

        prefs.putInt(PREFIX + PLAYBACK_FPS, playbackFPS);
        prefs.putFloat(PREFIX + PLAYBACK_LATENCY_CORRECTION,
                playbackLatencyCorrection);
        prefs.putBoolean(PREFIX + FOLLOW_PLAYBACK, followPlayback);
        prefs.putBoolean(PREFIX + FOLLOW_PLAYBACK_ON_START, followPlaybackOnStart);
        
        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    /**
     * @return the playbackFPS
     */
    public int getPlaybackFPS() {
        return playbackFPS;
    }

    /**
     * @param playbackFPS the playbackFPS to set
     */
    public void setPlaybackFPS(int playbackFPS) {
        this.playbackFPS = playbackFPS;
    }

    /**
     * @return the playbackLatencyCorrection
     */
    public float getPlaybackLatencyCorrection() {
        return playbackLatencyCorrection;
    }

    /**
     * @param playbackLatencyCorrection the playbackLatencyCorrection to set
     */
    public void setPlaybackLatencyCorrection(float playbackLatencyCorrection) {
        this.playbackLatencyCorrection = playbackLatencyCorrection;
    }

    public boolean isFollowPlayback() {
        return followPlayback;
    }

    public void setFollowPlayback(boolean followPlayback) {
        this.followPlayback = followPlayback;
    }

    public boolean isFollowPlaybackOnStart() {
        return followPlaybackOnStart;
    }

    public void setFollowPlaybackOnStart(boolean followPlaybackOnStart) {
        this.followPlaybackOnStart = followPlaybackOnStart;
    }
    
    
}
