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
 * You should have received a copy of the GNU Library General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.settings;

import java.io.File;
import java.io.Serializable;

import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 *
 * @author steven
 */
public class GeneralSettings implements Serializable {

    private static final String PREFIX = "general.";
    private static final String CSOUND_ERROR_WARNING_ENABLED = "csoundErrorWarningEnabled";
    private static final String DEFAULT_WORK_DIRECTORY = "defaultWorkDirectory";
    private static final String DRAW_ALPHA_BACKGROUND_ON_MARQUEE = "drawAlphaBackgroundOnMarquee";
    private static final String MESSAGE_COLORS_ENABLED = "messageColorsEnabled";
    private static final String NEW_USER_DEFAULTS_ENABLED = "newUserDefaultsEnabled";
    private String csoundDocRoot = "";
    private File defaultDirectory = null;
    private boolean newUserDefaultsEnabled = true;
    private boolean alphaEnabled = false;
    private boolean messageColorsEnabled = false;
    private boolean csoundErrorWarningEnabled = true;
    private static GeneralSettings instance = null;

    private GeneralSettings() {
//        setDefaultDirectory(new File(BlueSystem.getProgramRootDir()));
    }

    public static GeneralSettings getInstance() {
        if (instance == null) {
            instance = new GeneralSettings();

            final Preferences prefs = NbPreferences.forModule(
                    GeneralSettings.class);

            instance.defaultDirectory = new File(prefs.get(
                    PREFIX + DEFAULT_WORK_DIRECTORY, ""));
            instance.newUserDefaultsEnabled = prefs.getBoolean(
                    PREFIX + NEW_USER_DEFAULTS_ENABLED, true);
            instance.alphaEnabled = prefs.getBoolean(
                    PREFIX + DRAW_ALPHA_BACKGROUND_ON_MARQUEE, false);
            instance.messageColorsEnabled = prefs.getBoolean(
                    PREFIX + MESSAGE_COLORS_ENABLED, false);
            instance.csoundErrorWarningEnabled = prefs.getBoolean(
                    PREFIX + CSOUND_ERROR_WARNING_ENABLED, true);
        }

        return instance;
    }

    public void save() {

        final Preferences prefs = NbPreferences.forModule(GeneralSettings.class);

        prefs.put(PREFIX + DEFAULT_WORK_DIRECTORY,
                defaultDirectory.getAbsolutePath());
        prefs.putBoolean(PREFIX + NEW_USER_DEFAULTS_ENABLED,
                newUserDefaultsEnabled);
        prefs.putBoolean(PREFIX + DRAW_ALPHA_BACKGROUND_ON_MARQUEE, alphaEnabled);
        prefs.putBoolean(PREFIX + MESSAGE_COLORS_ENABLED, messageColorsEnabled);
        prefs.putBoolean(PREFIX + CSOUND_ERROR_WARNING_ENABLED,
                csoundErrorWarningEnabled);

        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    /* GETTER/SETTER METHODS */
    public File getDefaultDirectory() {
        return defaultDirectory;
    }

    public void setDefaultDirectory(File defaultDirectory) {
        this.defaultDirectory = defaultDirectory;
    }

    public boolean isAlphaEnabled() {
        return alphaEnabled;
    }

    public void setAlphaEnabled(boolean alphaEnabled) {
        this.alphaEnabled = alphaEnabled;
    }

    public boolean isMessageColorsEnabled() {
        return messageColorsEnabled;
    }

    public void setMessageColorsEnabled(boolean messageColorsEnabled) {
        this.messageColorsEnabled = messageColorsEnabled;
    }

    public boolean isNewUserDefaultsEnabled() {
        return newUserDefaultsEnabled;
    }

    public void setNewUserDefaultsEnabled(boolean newUserDefaultsEnabled) {
        this.newUserDefaultsEnabled = newUserDefaultsEnabled;
    }

    public boolean isCsoundErrorWarningEnabled() {
        return csoundErrorWarningEnabled;
    }

    public void setCsoundErrorWarningEnabled(boolean aCsoundErrorWarningEnabled) {
        csoundErrorWarningEnabled = aCsoundErrorWarningEnabled;
    }
}
