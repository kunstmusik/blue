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

import blue.score.SnapValue;
import blue.time.TimeBase;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 *
 * @author syi
 */
public class ProjectDefaultsSettings {

    private static final String PREFIX = "projectDefaults.";
    private static final String DEFAULT_AUTHOR = "defaultAuthor";
    private static final String MIXER_ENABLED = "mixerEnabled";
    private static final String LAYER_HEIGHT_DEFAULT = "layerHeightDefault";
    private static final String DEFAULT_SMPTE_FRAME_RATE = "defaultSmpteFrameRate";
    private static final String DEFAULT_PRIMARY_TIMEBASE = "defaultPrimaryTimeBase";
    private static final String DEFAULT_SECONDARY_TIMEBASE = "defaultSecondaryTimeBase";
    private static final String DEFAULT_SECONDARY_RULER_ENABLED = "defaultSecondaryRulerEnabled";
    private static final String DEFAULT_SNAP_ENABLED = "defaultSnapEnabled";
    private static final String DEFAULT_SNAP_VALUE = "defaultSnapValue";
    
    public String defaultAuthor;
    public boolean mixerEnabled;
    public int layerHeightDefault;
    public double defaultSmpteFrameRate;
    public TimeBase defaultPrimaryTimeBase;
    public TimeBase defaultSecondaryTimeBase;
    public boolean defaultSecondaryRulerEnabled;
    public boolean defaultSnapEnabled;
    public SnapValue defaultSnapValue;
    private static ProjectDefaultsSettings instance = null;

    private ProjectDefaultsSettings() {
    }

    public static ProjectDefaultsSettings getInstance() {
        if (instance == null) {
            instance = new ProjectDefaultsSettings();

            final Preferences prefs = NbPreferences.forModule(
                    ProjectDefaultsSettings.class);

            instance.defaultAuthor = prefs.get(PREFIX + DEFAULT_AUTHOR, "");
            instance.mixerEnabled = prefs.getBoolean(PREFIX + MIXER_ENABLED,
                    true);
            instance.layerHeightDefault = prefs.getInt(PREFIX + LAYER_HEIGHT_DEFAULT, 0);
            instance.defaultSmpteFrameRate = prefs.getDouble(PREFIX + DEFAULT_SMPTE_FRAME_RATE, 24.0);
            
            instance.defaultPrimaryTimeBase = parseEnum(TimeBase.class,
                    prefs.get(PREFIX + DEFAULT_PRIMARY_TIMEBASE, null), TimeBase.CSOUND_BEATS);
            instance.defaultSecondaryTimeBase = parseEnum(TimeBase.class,
                    prefs.get(PREFIX + DEFAULT_SECONDARY_TIMEBASE, null), TimeBase.TIME);
            instance.defaultSecondaryRulerEnabled = prefs.getBoolean(
                    PREFIX + DEFAULT_SECONDARY_RULER_ENABLED, false);
            instance.defaultSnapEnabled = prefs.getBoolean(
                    PREFIX + DEFAULT_SNAP_ENABLED, false);
            instance.defaultSnapValue = parseEnum(SnapValue.class,
                    prefs.get(PREFIX + DEFAULT_SNAP_VALUE, null), SnapValue.BEAT);
        }
        return instance;
    }

    public void save() {
        final Preferences prefs = NbPreferences.forModule(
                ProjectDefaultsSettings.class);

        prefs.put(PREFIX + DEFAULT_AUTHOR, defaultAuthor);
        prefs.putBoolean(PREFIX + MIXER_ENABLED, mixerEnabled);
        prefs.putInt(PREFIX + LAYER_HEIGHT_DEFAULT, layerHeightDefault);
        prefs.putDouble(PREFIX + DEFAULT_SMPTE_FRAME_RATE, defaultSmpteFrameRate);
        prefs.put(PREFIX + DEFAULT_PRIMARY_TIMEBASE, defaultPrimaryTimeBase.name());
        prefs.put(PREFIX + DEFAULT_SECONDARY_TIMEBASE, defaultSecondaryTimeBase.name());
        prefs.putBoolean(PREFIX + DEFAULT_SECONDARY_RULER_ENABLED, defaultSecondaryRulerEnabled);
        prefs.putBoolean(PREFIX + DEFAULT_SNAP_ENABLED, defaultSnapEnabled);
        prefs.put(PREFIX + DEFAULT_SNAP_VALUE, defaultSnapValue.name());
        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }
    
    private static <E extends Enum<E>> E parseEnum(Class<E> enumClass, String name, E defaultValue) {
        if (name == null) return defaultValue;
        try {
            return Enum.valueOf(enumClass, name);
        } catch (IllegalArgumentException e) {
            return defaultValue;
        }
    }
}
