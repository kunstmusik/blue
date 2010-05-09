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
public class ProjectDefaultsSettings {

    private static final String DEFAULT_AUTHOR = "defaultAuthor";

    private static final String MIXER_ENABLED = "mixerEnabled";

    public String defaultAuthor;

    public boolean mixerEnabled;

    private static ProjectDefaultsSettings instance = null;

    private ProjectDefaultsSettings() {
    }

    public static ProjectDefaultsSettings getInstance() {
        if (instance == null) {
            instance = new ProjectDefaultsSettings();

            final Preferences prefs = NbPreferences.forModule(ProjectDefaultsSettings.class);

            instance.defaultAuthor = prefs.get(DEFAULT_AUTHOR, "");
            instance.mixerEnabled = prefs.getBoolean(MIXER_ENABLED, false);
        }
        return instance;
    }

    public void save() {
        final Preferences prefs = NbPreferences.forModule(ProjectDefaultsSettings.class);

        prefs.put(DEFAULT_AUTHOR, defaultAuthor);
        prefs.putBoolean(MIXER_ENABLED, mixerEnabled);
        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }
}
