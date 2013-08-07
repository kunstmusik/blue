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
package blue.settings;

import blue.services.render.RealtimeRenderServiceFactory;
import java.io.Serializable;

import java.util.ArrayList;
import java.util.Collection;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.util.NbPreferences;

/**
 *
 * @author steven
 */
public class RealtimeRenderSettings implements Serializable {

    private static final String PREFIX = "realtimeRender.";
    private static final String ADVANCED_SETTINGS = "advancedSettings";
    private static final String AUDIO_DRIVER = "audioDriver";
    private static final String AUDIO_DRIVER_ENABLED = "audioDriverEnabled";
    private static final String AUDIO_IN_ENABLED = "audioInEnabled";
    private static final String AUDIO_IN_TEXT = "audioInText";
    private static final String AUDIO_OUT_ENABLED = "audioOutEnabled";
    private static final String AUDIO_OUT_TEXT = "audioOutText";
    private static final String BENCHMARK_ENABLED = "benchmarkEnabled";
    private static final String CSOUND_EXECUTABLE = "csoundExecutable";
    private static final String DEFAULT_KSMPS = "defaultKsmps";
    private static final String DEFAULT_NCHNLS = "defaultNchnls";
    private static final String DEFAULT_SR = "defaultSr";
    private static final String HARDWARE_BUFFER_ENABLED = "hardwareBufferEnabled";
    private static final String HARDWARE_BUFFER_SIZE = "hardwareBufferSize";
    private static final String MIDI_DRIVER = "midiDriver";
    private static final String MIDI_DRIVER_ENABLED = "midiDriverEnabled";
    private static final String MIDI_IN_ENABLED = "midiInEnabled";
    private static final String MIDI_IN_TEXT = "midiInText";
    private static final String MIDI_OUT_ENABLED = "midiOutEnabled";
    private static final String MIDI_OUT_TEXT = "midiOutText";
    private static final String NOTE_AMPS_ENABLED = "noteAmpsEnabled";
    private static final String OUT_OF_RANGE_ENABLED = "outOfRangeEnabled";
    private static final String SOFTWARE_BUFFER_ENABLED = "softwareBufferEnabled";
    private static final String SOFTWARE_BUFFER_SIZE = "softwareBufferSize";
    private static final String WARNINGS_ENABLED = "warningsEnabled";
    private static final String DISPLAYS_DISABLED = "displaysDisabled";
    private static final String USE_ZERO_DBFS = "useZeroDbFS";
    private static final String ZERO_DB_FS = "zeroDbFS";
    private static final String REALTIME_RENDER_SERVICE_FACTORY = "realtimeRenderServiceFactory";
    private static String[] AUDIO_DRIVERS = null;
    private static String[] MIDI_DRIVERS = null;

    private static RealtimeRenderServiceFactory findRealtimeRenderServiceFactory(String renderServiceName) {
        Collection<? extends RealtimeRenderServiceFactory> results =
                Lookup.getDefault().lookupAll(RealtimeRenderServiceFactory.class);

        RealtimeRenderServiceFactory foundService = null;

        if (renderServiceName == null || renderServiceName.isEmpty()) {
            foundService = (RealtimeRenderServiceFactory) results.toArray()[0];
        } else {
            for (RealtimeRenderServiceFactory service : results) {
                if (service.toString().equals(renderServiceName)) {
                    foundService = service;
                    break;
                }
            }
        }

        if (foundService == null) {
            foundService = (RealtimeRenderServiceFactory) results.toArray()[0];
        }

        return foundService;
    }
    // PROPERTIES
    public boolean audioDriverEnabled = true;
    public String audioDriver = "PortAudio";
    public boolean midiDriverEnabled = false;
    public String midiDriver = "PortMidi";
    public boolean audioOutEnabled = true;
    public boolean audioInEnabled = false;
    public boolean midiInEnabled = false;
    public boolean midiOutEnabled = false;
    public boolean softwareBufferEnabled = false;
    public boolean hardwareBufferEnabled = false;
    public boolean noteAmpsEnabled = true;
    public boolean outOfRangeEnabled = true;
    public boolean warningsEnabled = true;
    public boolean benchmarkEnabled = true;
    public String audioOutText = "dac";
    public String audioInText = "adc";
    public String midiInText = "";
    public String midiOutText = "";
    public String csoundExecutable = "csound";
    public String defaultSr = "44100";
    public String defaultKsmps = "1";
    public String defaultNchnls = "2";
    public int softwareBufferSize = 256;
    public int hardwareBufferSize = 1024;
    public boolean displaysDisabled = true;
    public String advancedSettings = "";
    public boolean useZeroDbFS = true;
    public String zeroDbFS = "1";
    public RealtimeRenderServiceFactory renderServiceFactory = null;
    private static RealtimeRenderSettings instance = null;

    private RealtimeRenderSettings() {
    }

    public static RealtimeRenderSettings getInstance() {

        if (instance == null) {
            String osName = System.getProperty("os.name");

            int softwareBufferSize = 256;
            int hardwareBufferSize = 1024;

            String csoundExecutableDefault = "csound";
            String audioDriverDefault = "PortAudio";

            if (osName.indexOf("Windows") >= 0) {
                softwareBufferSize = 4096;
                hardwareBufferSize = 16384;
            } else if (osName.toLowerCase().indexOf("mac") >= 0) {
                softwareBufferSize = 1024;
                hardwareBufferSize = 4096;
                csoundExecutableDefault = "/usr/local/bin/csound";
                audioDriverDefault = "pa_bl";
            }

            instance = new RealtimeRenderSettings();


            final Preferences prefs = NbPreferences.forModule(
                    RealtimeRenderSettings.class);

            instance.csoundExecutable = prefs.get(PREFIX + CSOUND_EXECUTABLE,
                    csoundExecutableDefault);
            instance.defaultSr = prefs.get(PREFIX + DEFAULT_SR, "44100");
            instance.defaultKsmps = prefs.get(PREFIX + DEFAULT_KSMPS, "1");
            instance.defaultNchnls = prefs.get(PREFIX + DEFAULT_NCHNLS, "2");

            instance.audioDriverEnabled = prefs.getBoolean(
                    PREFIX + AUDIO_DRIVER_ENABLED, true);
            instance.audioDriver = prefs.get(PREFIX + AUDIO_DRIVER,
                    audioDriverDefault);
            instance.audioOutEnabled = prefs.getBoolean(
                    PREFIX + AUDIO_OUT_ENABLED, true);
            instance.audioOutText = prefs.get(PREFIX + AUDIO_OUT_TEXT, "dac");
            instance.audioInEnabled = prefs.getBoolean(PREFIX + AUDIO_IN_ENABLED,
                    false);
            instance.audioInText = prefs.get(PREFIX + AUDIO_IN_TEXT, "adc");

            instance.midiDriverEnabled = prefs.getBoolean(
                    PREFIX + MIDI_DRIVER_ENABLED, true);
            instance.midiDriver = prefs.get(PREFIX + MIDI_DRIVER, "PortMidi");
            instance.midiOutEnabled = prefs.getBoolean(PREFIX + MIDI_OUT_ENABLED,
                    false);
            instance.midiOutText = prefs.get(PREFIX + MIDI_OUT_TEXT, "");
            instance.midiInEnabled = prefs.getBoolean(PREFIX + MIDI_IN_ENABLED,
                    false);
            instance.midiInText = prefs.get(PREFIX + MIDI_IN_TEXT, "");

            instance.hardwareBufferEnabled = prefs.getBoolean(
                    PREFIX + HARDWARE_BUFFER_ENABLED,
                    false);
            instance.hardwareBufferSize = prefs.getInt(
                    PREFIX + HARDWARE_BUFFER_SIZE,
                    hardwareBufferSize);

            instance.softwareBufferEnabled = prefs.getBoolean(
                    PREFIX + SOFTWARE_BUFFER_ENABLED,
                    false);
            instance.softwareBufferSize = prefs.getInt(
                    PREFIX + SOFTWARE_BUFFER_SIZE,
                    softwareBufferSize);

            instance.noteAmpsEnabled = prefs.getBoolean(
                    PREFIX + NOTE_AMPS_ENABLED, true);
            instance.outOfRangeEnabled = prefs.getBoolean(
                    PREFIX + OUT_OF_RANGE_ENABLED, true);
            instance.warningsEnabled = prefs.getBoolean(
                    PREFIX + WARNINGS_ENABLED, true);
            instance.benchmarkEnabled = prefs.getBoolean(
                    PREFIX + BENCHMARK_ENABLED, true);

            instance.displaysDisabled = prefs.getBoolean(
                    PREFIX + DISPLAYS_DISABLED, true);

            instance.advancedSettings = prefs.get(PREFIX + ADVANCED_SETTINGS, "");

            instance.useZeroDbFS = prefs.getBoolean(PREFIX + USE_ZERO_DBFS, true);
            instance.zeroDbFS = prefs.get(PREFIX + ZERO_DB_FS, "1");

            String factoryName =
                    prefs.get(PREFIX + REALTIME_RENDER_SERVICE_FACTORY, null);

            instance.renderServiceFactory = findRealtimeRenderServiceFactory(
                    factoryName);
        }
        return instance;
    }

    public void save() {
        final Preferences prefs = NbPreferences.forModule(
                RealtimeRenderSettings.class);

        prefs.put(PREFIX + CSOUND_EXECUTABLE, csoundExecutable);
        prefs.put(PREFIX + DEFAULT_SR, defaultSr);
        prefs.put(PREFIX + DEFAULT_KSMPS, defaultKsmps);
        prefs.put(PREFIX + DEFAULT_NCHNLS, defaultNchnls);

        prefs.putBoolean(PREFIX + AUDIO_DRIVER_ENABLED, audioDriverEnabled);
        prefs.put(PREFIX + AUDIO_DRIVER, audioDriver);
        prefs.putBoolean(PREFIX + AUDIO_OUT_ENABLED, audioOutEnabled);
        prefs.put(PREFIX + AUDIO_OUT_TEXT, audioOutText);
        prefs.putBoolean(PREFIX + AUDIO_IN_ENABLED, audioInEnabled);
        prefs.put(PREFIX + AUDIO_IN_TEXT, audioInText);

        prefs.putBoolean(PREFIX + MIDI_DRIVER_ENABLED, midiDriverEnabled);
        prefs.put(PREFIX + MIDI_DRIVER, midiDriver);
        prefs.putBoolean(PREFIX + MIDI_OUT_ENABLED, midiOutEnabled);
        prefs.put(PREFIX + MIDI_OUT_TEXT, midiOutText.toString());
        prefs.putBoolean(PREFIX + MIDI_IN_ENABLED, midiInEnabled);
        prefs.put(PREFIX + MIDI_IN_TEXT, midiInText);

        prefs.putBoolean(PREFIX + HARDWARE_BUFFER_ENABLED, hardwareBufferEnabled);
        prefs.putInt(PREFIX + HARDWARE_BUFFER_SIZE, hardwareBufferSize);

        prefs.putBoolean(PREFIX + SOFTWARE_BUFFER_ENABLED, softwareBufferEnabled);
        prefs.putInt(PREFIX + SOFTWARE_BUFFER_SIZE, softwareBufferSize);

        prefs.putBoolean(PREFIX + NOTE_AMPS_ENABLED, noteAmpsEnabled);
        prefs.putBoolean(PREFIX + WARNINGS_ENABLED, warningsEnabled);
        prefs.putBoolean(PREFIX + OUT_OF_RANGE_ENABLED, outOfRangeEnabled);
        prefs.putBoolean(PREFIX + BENCHMARK_ENABLED, benchmarkEnabled);

        prefs.putBoolean(PREFIX + DISPLAYS_DISABLED, displaysDisabled);

        prefs.put(PREFIX + ADVANCED_SETTINGS, advancedSettings);

        prefs.putBoolean(PREFIX + USE_ZERO_DBFS, useZeroDbFS);
        prefs.put(PREFIX + ZERO_DB_FS, zeroDbFS);

        prefs.put(PREFIX + REALTIME_RENDER_SERVICE_FACTORY,
                renderServiceFactory.toString());

        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public String getCommandLine(boolean useAudioOut, boolean useAudioIn,
            boolean useMidiIn, boolean useMidiOut) {
        StringBuffer buffer = new StringBuffer();

//        if (APIUtilities.isCsoundAPIAvailable()
//                && GeneralSettings.getInstance().isUsingCsoundAPI()) {
//            buffer.append("csound ");
//        } else {
            buffer.append(csoundExecutable).append(" ");
  //      }

        if (!GeneralSettings.getInstance().isMessageColorsEnabled()) {
            buffer.append("-+msg_color=false ");
        }

        if (audioDriverEnabled) {
            buffer.append("-+rtaudio=").append(audioDriver).append(" ");
        }

        if (useAudioOut) {
            buffer.append("-o ").append(audioOutText).append(" ");
        }

        if (useAudioIn) {
            buffer.append("-i ").append(audioInText).append(" ");
        }

        if (useMidiIn || useMidiOut) {
            if (midiDriverEnabled) {
                buffer.append("-+rtmidi=").append(midiDriver).append(" ");
            }
        }

        if (useMidiIn) {
            buffer.append("-M ").append(midiInText).append(" ");
        }

        if (useMidiOut) {
            buffer.append("-Q ").append(midiOutText).append(" ");
        }

        if (softwareBufferEnabled) {
            buffer.append("-b").append(softwareBufferSize).append(" ");
        }

        if (hardwareBufferEnabled) {
            buffer.append("-B").append(hardwareBufferSize).append(" ");
        }

        if (displaysDisabled) {
            buffer.append("-d ");
        }

        return buffer.toString();
    }

    public static String[] getMIDIDrivers() {
        if (MIDI_DRIVERS == null) {
            String osName = System.getProperty("os.name").toLowerCase();

            if (osName.indexOf("windows") >= 0) {
                MIDI_DRIVERS = new String[]{"PortMIDI", "MME", "null"};
            } else if (osName.indexOf("mac") >= 0) {
                MIDI_DRIVERS = new String[]{"PortMIDI", "null"};
            } else if (osName.indexOf("linux") >= 0) {
                MIDI_DRIVERS = new String[]{"PortMIDI", "ALSA", "null"};
            } else {
                MIDI_DRIVERS = new String[]{"PortMIDI", "MME", "ALSA", "null"};
            }
        }

        return MIDI_DRIVERS;
    }

    public static String[] getAudioDrivers() {

        if (AUDIO_DRIVERS == null) {
            String osName = System.getProperty("os.name").toLowerCase();

            if (osName.indexOf("windows") >= 0) {
                AUDIO_DRIVERS = new String[]{"PortAudio", "pa_cb", "pa_bl",
                    "MME", "null"};
            } else if (osName.indexOf("mac") >= 0) {
                AUDIO_DRIVERS = new String[]{"PortAudio", "pa_cb", "pa_bl",
                    "CoreAudio", "JACK", "null"};
            } else if (osName.indexOf("linux") >= 0) {
                AUDIO_DRIVERS = new String[]{"PortAudio", "pa_cb", "pa_bl",
                    "ALSA", "JACK", "pulse", "null"};
            } else {
                AUDIO_DRIVERS = new String[]{"PortAudio", "pa_cb", "pa_bl",
                    "MME", "ALSA", "JACK", "pulse", "CoreAudio", "null"};
            }
        }

        return AUDIO_DRIVERS;
    }

    public static RealtimeRenderServiceFactory[] getAvailableRealtimeRenderServices() {
        Collection<? extends RealtimeRenderServiceFactory> results =
                Lookup.getDefault().lookupAll(RealtimeRenderServiceFactory.class);

        ArrayList<RealtimeRenderServiceFactory> retVal = new ArrayList<RealtimeRenderServiceFactory>();
        for (RealtimeRenderServiceFactory service : results) {
            if (service.isAvailable()) {
                retVal.add(service);
            }
        }

        return retVal.toArray(new RealtimeRenderServiceFactory[0]);
    }
}
