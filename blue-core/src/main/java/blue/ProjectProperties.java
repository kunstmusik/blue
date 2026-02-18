package blue;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.Objects;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public final class ProjectProperties {

    private final PropertyChangeSupport pcs = new PropertyChangeSupport(this);

    public String title = "";
    public String author = "";
    public String notes = "";

    private String sampleRate = "44100";
    public String ksmps = "1";
    public String channels = "2";
    public boolean useZeroDbFS = false; // set false by default for legacy projects
    public String zeroDbFS = "1";

    public String diskSampleRate = "44100";
    public String diskKsmps = "1";
    public String diskChannels = "2";
    public boolean diskUseZeroDbFS = false; // set false by default for legacy projects
    public String diskZeroDbFS = "1";

    /* REALTIME SETTINGS */
    public boolean useAudioOut = true;

    public boolean useAudioIn = false;

    public boolean useMidiIn = false;

    public boolean useMidiOut = false;

    public boolean noteAmpsEnabled = true;

    public boolean outOfRangeEnabled = true;

    public boolean warningsEnabled = true;

    public boolean benchmarkEnabled = true;

    public String advancedSettings = "";

    public boolean completeOverride = false;

    /* DISK SETTINGS */
    public String fileName = "";

    public boolean askOnRender = false;

    public boolean diskNoteAmpsEnabled = true;

    public boolean diskOutOfRangeEnabled = true;

    public boolean diskWarningsEnabled = true;

    public boolean diskBenchmarkEnabled = true;

    public String diskAdvancedSettings = "";

    public boolean diskCompleteOverride = false;

    public boolean diskAlwaysRenderEntireProject = false;

    /* MEDIA FOLDER */
    public String mediaFolder = "";
    public boolean copyToMediaFileOnImport = true;

    public void addPropertyChangeListener(PropertyChangeListener listener) {
        pcs.addPropertyChangeListener(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        pcs.removePropertyChangeListener(listener);
    }

    public String getSampleRate() {
        return sampleRate;
    }

    public void setSampleRate(String sampleRate) {
        String old = this.sampleRate;
        this.sampleRate = sampleRate;
        pcs.firePropertyChange("sampleRate", old, sampleRate);
    }

    public ProjectProperties() {
    }

    public ProjectProperties(ProjectProperties props) {
        title = props.title;
        author = props.author;
        notes = props.notes;

        sampleRate = props.sampleRate;
        ksmps = props.ksmps;
        channels = props.channels;
        useZeroDbFS = props.useZeroDbFS; // set false by default for legacy projects
        zeroDbFS = props.zeroDbFS;

        diskSampleRate = props.diskSampleRate;
        diskKsmps = props.diskKsmps;
        diskChannels = props.diskChannels;
        diskUseZeroDbFS = props.diskUseZeroDbFS; // set false by default for legacy projects
        diskZeroDbFS = props.diskZeroDbFS;

        /* REALTIME SETTINGS */
        useAudioOut = props.useAudioOut;
        useAudioIn = props.useAudioIn;
        useMidiIn = props.useMidiIn;
        useMidiOut = props.useMidiOut;
        noteAmpsEnabled = props.noteAmpsEnabled;
        outOfRangeEnabled = props.outOfRangeEnabled;
        warningsEnabled = props.warningsEnabled;
        benchmarkEnabled = props.benchmarkEnabled;
        advancedSettings = props.advancedSettings;
        completeOverride = props.completeOverride;

        /* DISK SETTINGS */
        fileName = props.fileName;
        askOnRender = props.askOnRender;
        diskNoteAmpsEnabled = props.diskNoteAmpsEnabled;
        diskOutOfRangeEnabled = props.diskOutOfRangeEnabled;
        diskWarningsEnabled = props.diskWarningsEnabled;
        diskBenchmarkEnabled = props.diskBenchmarkEnabled;
        diskAdvancedSettings = props.diskAdvancedSettings;
        diskCompleteOverride = props.diskCompleteOverride;
        diskAlwaysRenderEntireProject = props.diskAlwaysRenderEntireProject;

        mediaFolder = props.mediaFolder;
        copyToMediaFileOnImport = props.copyToMediaFileOnImport;
    }

    public String getKsmps() {
        // int sr = Integer.parseInt(sampleRate.trim());
        // int kr = Integer.parseInt(controlRate.trim());
        // return Integer.toString(sr / kr);
        return ksmps;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public static ProjectProperties loadFromXML(Element data) {
        ProjectProperties retVal = new ProjectProperties();

        Elements nodes = data.getElements();

        String kr = null;
        String commandLine = null;
        String diskCommandLine = null;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            String nodeVal = Objects.requireNonNullElse(node.getTextString(), "");
            switch (nodeName) {
                case "title" ->
                    retVal.title = nodeVal;
                case "author" ->
                    retVal.author = nodeVal;
                case "notes" ->
                    retVal.notes = nodeVal;
                case "sampleRate" ->
                    retVal.setSampleRate(nodeVal);
                case "controlRate" ->
                    kr = nodeVal;
                case "ksmps" ->
                    retVal.ksmps = nodeVal;
                case "useZeroDbFS" ->
                    retVal.useZeroDbFS = Boolean.parseBoolean(nodeVal);
                case "zeroDbFS" ->
                    retVal.zeroDbFS = nodeVal;
                case "channels" ->
                    retVal.channels = nodeVal;
                case "commandLine" ->
                    commandLine = nodeVal;
                case "diskSampleRate" ->
                    retVal.diskSampleRate = nodeVal;
                case "diskKsmps" ->
                    retVal.diskKsmps = nodeVal;
                case "diskChannels" ->
                    retVal.diskChannels = nodeVal;
                case "diskCommandLine" ->
                    diskCommandLine = nodeVal;
                case "diskUseZeroDbFS" ->
                    retVal.diskUseZeroDbFS = Boolean.parseBoolean(nodeVal);
                case "diskZeroDbFS" ->
                    retVal.diskZeroDbFS = nodeVal;
                case "useAudioOut" ->
                    retVal.useAudioOut = Boolean.parseBoolean(nodeVal);
                case "useAudioIn" ->
                    retVal.useAudioIn = Boolean.parseBoolean(nodeVal);
                case "useMidiIn" ->
                    retVal.useMidiIn = Boolean.parseBoolean(nodeVal);
                case "useMidiOut" ->
                    retVal.useMidiOut = Boolean.parseBoolean(nodeVal);
                case "noteAmpsEnabled" ->
                    retVal.noteAmpsEnabled = Boolean.parseBoolean(nodeVal);
                case "outOfRangeEnabled" ->
                    retVal.outOfRangeEnabled = Boolean.parseBoolean(nodeVal);
                case "warningsEnabled" ->
                    retVal.warningsEnabled = Boolean.parseBoolean(nodeVal);
                case "benchmarkEnabled" ->
                    retVal.benchmarkEnabled = Boolean.parseBoolean(nodeVal);
                case "advancedSettings" ->
                    retVal.advancedSettings = nodeVal;
                case "completeOverride" ->
                    retVal.completeOverride = Boolean.parseBoolean(nodeVal);
                case "fileName" ->
                    retVal.fileName = nodeVal;
                case "askOnRender" ->
                    retVal.askOnRender = Boolean.parseBoolean(nodeVal);
                case "diskNoteAmpsEnabled" ->
                    retVal.diskNoteAmpsEnabled = Boolean.parseBoolean(nodeVal);
                case "diskOutOfRangeEnabled" ->
                    retVal.diskOutOfRangeEnabled = Boolean.parseBoolean(nodeVal);
                case "diskWarningsEnabled" ->
                    retVal.diskWarningsEnabled = Boolean.parseBoolean(nodeVal);
                case "diskBenchmarkEnabled" ->
                    retVal.diskBenchmarkEnabled = Boolean.parseBoolean(nodeVal);
                case "diskAdvancedSettings" ->
                    retVal.diskAdvancedSettings = nodeVal;
                case "diskCompleteOverride" ->
                    retVal.diskCompleteOverride = Boolean.parseBoolean(nodeVal);
                case "diskAlwaysRenderEntireProject" ->
                    retVal.diskAlwaysRenderEntireProject = Boolean.parseBoolean(nodeVal);
                case "mediaFolder" ->
                    retVal.mediaFolder = nodeVal;
                case "copyToMediaFolderOnImport" ->
                    retVal.copyToMediaFileOnImport = Boolean.parseBoolean(nodeVal);
            }

        }

        // Upgrade Migration for older values
        if (kr != null && kr.length() > 0 && retVal.ksmps != null
                && retVal.ksmps.length() == 0) {
            try {
                int ksmpsNum = Integer.parseInt(retVal.getSampleRate())
                        / Integer.parseInt(kr);
                retVal.ksmps = Integer.toString(ksmpsNum);
            } catch (NumberFormatException nfe) {

            }
        }

        if (commandLine != null) {
            retVal.advancedSettings = commandLine;
            retVal.completeOverride = true;
        }

        if (diskCommandLine != null) {
            retVal.diskAdvancedSettings = diskCommandLine;
            retVal.diskCompleteOverride = true;
        }

        return retVal;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("projectProperties");

        retVal.addElement("title").setText(title);
        retVal.addElement("author").setText(author);
        retVal.addElement("notes").setText(notes);

        retVal.addElement("sampleRate").setText(getSampleRate());
        retVal.addElement("ksmps").setText(ksmps);
        retVal.addElement("channels").setText(channels);
        retVal.addElement(XMLUtilities.writeBoolean("useZeroDbFS", useZeroDbFS));
        retVal.addElement("zeroDbFS").setText(zeroDbFS);

        retVal.addElement("diskSampleRate").setText(diskSampleRate);
        retVal.addElement("diskKsmps").setText(diskKsmps);
        retVal.addElement("diskChannels").setText(diskChannels);
        retVal.addElement(XMLUtilities.writeBoolean("diskUseZeroDbFS", diskUseZeroDbFS));
        retVal.addElement("diskZeroDbFS").setText(diskZeroDbFS);

        retVal
                .addElement(XMLUtilities.writeBoolean("useAudioOut",
                        useAudioOut));
        retVal.addElement(XMLUtilities.writeBoolean("useAudioIn", useAudioIn));
        retVal.addElement(XMLUtilities.writeBoolean("useMidiIn", useMidiIn));
        retVal.addElement(XMLUtilities.writeBoolean("useMidiOut", useMidiOut));
        retVal.addElement(XMLUtilities.writeBoolean("noteAmpsEnabled",
                noteAmpsEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("outOfRangeEnabled",
                outOfRangeEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("warningsEnabled",
                warningsEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("benchmarkEnabled",
                benchmarkEnabled));
        retVal.addElement("advancedSettings").setText(advancedSettings);
        retVal.addElement(XMLUtilities.writeBoolean("completeOverride",
                completeOverride));

        retVal.addElement("fileName").setText(fileName);
        retVal
                .addElement(XMLUtilities.writeBoolean("askOnRender",
                        askOnRender));
        retVal.addElement(XMLUtilities.writeBoolean("diskNoteAmpsEnabled",
                diskNoteAmpsEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("diskOutOfRangeEnabled",
                diskOutOfRangeEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("diskWarningsEnabled",
                diskWarningsEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("diskBenchmarkEnabled",
                diskBenchmarkEnabled));
        retVal.addElement("diskAdvancedSettings").setText(diskAdvancedSettings);
        retVal.addElement(XMLUtilities.writeBoolean("diskCompleteOverride",
                diskCompleteOverride));
        retVal.addElement(XMLUtilities.writeBoolean("diskAlwaysRenderEntireProject",
                diskAlwaysRenderEntireProject));

        retVal.addElement("mediaFolder").setText(mediaFolder);
        retVal.addElement(XMLUtilities.writeBoolean("copyToMediaFileOnImport",
                copyToMediaFileOnImport));

        return retVal;
    }

}
