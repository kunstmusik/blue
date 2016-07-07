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

import blue.services.render.DiskRenderServiceFactory;
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
public class DiskRenderSettings implements Serializable {

    public static final String[] FILE_FORMATS = new String[]{"WAV", "AIFF",
        "AU", "RAW", "IRCAM", "W64", "WAVEX", "SD2", "FLAC"};
    public static final String[] SAMPLE_FORMATS = new String[]{"ALAW",
        "ULAW", "SCHAR", "UCHAR", "FLOAT", "SHORT", "LONG", "24BIT"};
    private static final String PREFIX = "diskRender.";
    private static final String ADVANCED_SETTINGS = "advancedSettings";
    private static final String BENCHMARK_ENABLED = "benchmarkEnabled";
    private static final String CSOUND_EXECUTABLE = "csoundExecutable";
    private static final String DEFAULT_KSMPS = "defaultKsmps";
    private static final String DEFAULT_NCHNLS = "defaultNchnls";
    private static final String DEFAULT_SR = "defaultSr";
    private static final String DITHER_OUTPUT = "ditherOutput";
    private static final String EXTERNAL_PLAY_COMMAND = "externalPlayCommand";
    private static final String EXTERNAL_PLAY_COMMAND_ENABLED = "externalPlayCommandEnabled";
    private static final String EXTERNAL_OPEN_COMMAND = "externalOpenCommand";
    private static final String FILE_FORMAT = "fileFormat";
    private static final String FILE_FORMAT_ENABLED = "fileFormatEnabled";
    private static final String NOTE_AMPS_ENABLED = "noteAmpsEnabled";
    private static final String OUT_OF_RANGE_ENABLED = "outOfRangeEnabled";
    private static final String REWRITE_HEADER = "rewriteHeader";
    private static final String SAMPLE_FORMAT = "sampleFormat";
    private static final String SAMPLE_FORMAT_ENABLED = "sampleFormatEnabled";
    private static final String SAVE_PEAK_INFORMATION = "savePeakInformation";
    private static final String WARNINGS_ENABLED = "warningsEnabled";
    private static final String DISPLAYS_DISABLED = "displaysDisabled";
    private static final String USE_ZERO_DBFS = "useZeroDbFS";
    private static final String ZERO_DB_FS = "zeroDbFS";
    private static final String DISK_RENDER_SERVICE_FACTORY = "diskRenderServiceFactory";
    public String csoundExecutable = "csound";
    public String fileFormat = "WAV";
    public String sampleFormat = "SHORT";
    public String defaultSr = "44100";
    public String defaultKsmps = "1";
    public String defaultNchnls = "2";
    public boolean noteAmpsEnabled = true;
    public boolean outOfRangeEnabled = true;
    public boolean warningsEnabled = true;
    public boolean benchmarkEnabled = true;
    public boolean fileFormatEnabled = true;
    public boolean sampleFormatEnabled = true;
    public boolean savePeakInformation = true;
    public boolean ditherOutput = false;
    public boolean rewriteHeader = false;
    public boolean externalPlayCommandEnabled = false;
    public String externalPlayCommand = "command $outfile";
    public String externalOpenCommand = "command $outfile";
    public boolean displaysDisabled = true;
    public String advancedSettings = "";
    public boolean useZeroDbFS = true;
    public String zeroDbFS = "1";
    public DiskRenderServiceFactory renderServiceFactory = null;
    private static DiskRenderSettings instance = null;

    private DiskRenderSettings() {
    }

    private static DiskRenderServiceFactory findDiskRenderService(String renderServiceName) {
        DiskRenderServiceFactory[] services = getAvailableDiskRenderServices();

        DiskRenderServiceFactory foundService = null;


        if (renderServiceName == null || renderServiceName.isEmpty()) {
            foundService = services[0];
        } else {

            for (DiskRenderServiceFactory service : services) {
                if (service.toString().equals(renderServiceName)) {
                    foundService = service;
                    break;
                }
            }
            if (foundService == null) {
                foundService = services[0];
            }
        }


        return foundService;
    }

    public static DiskRenderSettings getInstance() {

        if (instance == null) {
            instance = new DiskRenderSettings();

            final Preferences prefs = NbPreferences.forModule(
                    DiskRenderSettings.class);

            String osName = System.getProperty("os.name");

            String csoundExecutableDefault = (osName.toLowerCase().indexOf("mac") >= 0)
                    ? "/usr/local/bin/csound" : "csound";

            instance.csoundExecutable = prefs.get(PREFIX + CSOUND_EXECUTABLE,
                    csoundExecutableDefault);
            instance.defaultSr = prefs.get(PREFIX + DEFAULT_SR, "44100");
            instance.defaultKsmps = prefs.get(PREFIX + DEFAULT_KSMPS, "1");
            instance.defaultNchnls = prefs.get(PREFIX + DEFAULT_NCHNLS, "2");

            instance.externalPlayCommandEnabled = prefs.getBoolean(
                    PREFIX + EXTERNAL_PLAY_COMMAND_ENABLED, false);
            instance.externalPlayCommand = prefs.get(
                    PREFIX + EXTERNAL_PLAY_COMMAND,
                    "command $outfile");
            instance.externalOpenCommand = prefs.get(
                    PREFIX + EXTERNAL_OPEN_COMMAND,
                    "command $outfile");


            instance.fileFormatEnabled = prefs.getBoolean(
                    PREFIX + FILE_FORMAT_ENABLED, true);
            instance.fileFormat = prefs.get(PREFIX + FILE_FORMAT, "WAV");
            instance.sampleFormatEnabled = prefs.getBoolean(
                    PREFIX + SAMPLE_FORMAT_ENABLED,
                    true);
            instance.sampleFormat = prefs.get(PREFIX + SAMPLE_FORMAT, "SHORT");
            instance.savePeakInformation = prefs.getBoolean(
                    PREFIX + SAVE_PEAK_INFORMATION, true);
            instance.ditherOutput = prefs.getBoolean(PREFIX + DITHER_OUTPUT,
                    false);
            instance.rewriteHeader = prefs.getBoolean(PREFIX + REWRITE_HEADER,
                    true);

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


            String renderServiceName =
                    prefs.get(PREFIX + DISK_RENDER_SERVICE_FACTORY, null);

            instance.renderServiceFactory = findDiskRenderService(
                    renderServiceName);

        }

        return instance;
    }

    public void save() {
        final Preferences prefs = NbPreferences.forModule(
                DiskRenderSettings.class);

        prefs.put(PREFIX + CSOUND_EXECUTABLE, csoundExecutable);
        prefs.put(PREFIX + DEFAULT_SR, defaultSr);
        prefs.put(PREFIX + DEFAULT_KSMPS, defaultKsmps);
        prefs.put(PREFIX + DEFAULT_NCHNLS, defaultNchnls);

        prefs.putBoolean(PREFIX + EXTERNAL_PLAY_COMMAND_ENABLED,
                externalPlayCommandEnabled);
        prefs.put(PREFIX + EXTERNAL_PLAY_COMMAND, externalPlayCommand);
        prefs.put(PREFIX + EXTERNAL_OPEN_COMMAND, externalOpenCommand);

        prefs.putBoolean(PREFIX + FILE_FORMAT_ENABLED, fileFormatEnabled);
        prefs.put(PREFIX + FILE_FORMAT, fileFormat);

        prefs.putBoolean(PREFIX + SAMPLE_FORMAT_ENABLED, sampleFormatEnabled);
        prefs.put(PREFIX + SAMPLE_FORMAT, sampleFormat);
        prefs.putBoolean(PREFIX + SAVE_PEAK_INFORMATION, savePeakInformation);
        prefs.putBoolean(PREFIX + DITHER_OUTPUT, ditherOutput);
        prefs.putBoolean(PREFIX + REWRITE_HEADER, rewriteHeader);

        prefs.putBoolean(PREFIX + NOTE_AMPS_ENABLED, noteAmpsEnabled);
        prefs.putBoolean(PREFIX + WARNINGS_ENABLED, warningsEnabled);
        prefs.putBoolean(PREFIX + OUT_OF_RANGE_ENABLED, outOfRangeEnabled);
        prefs.putBoolean(PREFIX + BENCHMARK_ENABLED, benchmarkEnabled);

        prefs.putBoolean(PREFIX + DISPLAYS_DISABLED, displaysDisabled);

        prefs.put(PREFIX + ADVANCED_SETTINGS, advancedSettings);

        prefs.putBoolean(PREFIX + USE_ZERO_DBFS, useZeroDbFS);
        prefs.put(PREFIX + ZERO_DB_FS, zeroDbFS);

        prefs.put(PREFIX + DISK_RENDER_SERVICE_FACTORY,
                renderServiceFactory.toString());

        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public String getCommandLine() {
        StringBuffer buffer = new StringBuffer();

//        if (APIUtilities.isCsoundAPIAvailable() &&
//                GeneralSettings.getInstance().isUsingCsoundAPI()) {
//            buffer.append("csound ");
//        } else {
        buffer.append(csoundExecutable).append(" ");
//        }

        if (!GeneralSettings.getInstance().isMessageColorsEnabled()) {
            buffer.append("-+msg_color=false ");
        }

        if (fileFormatEnabled) {
            buffer.append("--format=").append(fileFormat.toLowerCase());

            if (sampleFormatEnabled) {
                buffer.append(":").append(sampleFormat.toLowerCase());
            }

            buffer.append(" ");
        }

        if (!savePeakInformation) {
            buffer.append("-K ");
        }

        if (ditherOutput) {
            buffer.append("-Z ");
        }

        if (rewriteHeader) {
            buffer.append("-R ");
        }

        if (displaysDisabled) {
            buffer.append("-d ");
        }
        // buffer.append(advancedSettings).append(" ");

        return buffer.toString();
    }

    public static DiskRenderServiceFactory[] getAvailableDiskRenderServices() {
        Collection<? extends DiskRenderServiceFactory> services = Lookup.getDefault().lookupAll(
                                                               DiskRenderServiceFactory.class);

        ArrayList<DiskRenderServiceFactory> results = new ArrayList<>();
        
        for (DiskRenderServiceFactory factory : services) {
           if(factory.isAvailable()) {
               results.add(factory);
           } 
        }
        
        return results.toArray(new DiskRenderServiceFactory[0]);
    }
}
