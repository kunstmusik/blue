package blue;

import blue.utility.ValuesUtility;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public final class ProjectProperties {

    public String title = "";
    public String author = "";
    public String notes = "";

    public String sampleRate = "44100";
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
            String nodeVal = node.getTextString();
            switch (nodeName) {
                case "title":
                    retVal.title = nodeVal;
                    break;
                case "author":
                    retVal.author = nodeVal;
                    break;
                case "notes":
                    retVal.notes = nodeVal;
                    break;
                case "sampleRate":
                    retVal.sampleRate = nodeVal;
                    break;
                case "controlRate":
                    kr = nodeVal;
                    break;
                case "ksmps":
                    retVal.ksmps = nodeVal;
                    break;
                case "useZeroDbFS":
                    retVal.useZeroDbFS = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "zeroDbFS":
                    retVal.zeroDbFS = nodeVal;
                    break;
                case "channels":
                    retVal.channels = nodeVal;
                    break;
                case "commandLine":
                    commandLine = nodeVal;
                    break;
                case "diskSampleRate":
                    retVal.diskSampleRate = nodeVal;
                    break;
                case "diskKsmps":
                    retVal.diskKsmps = nodeVal;
                    break;
                case "diskChannels":
                    retVal.diskChannels = nodeVal;
                    break;
                case "diskCommandLine":
                    diskCommandLine = nodeVal;
                    break;
                case "diskUseZeroDbFS":
                    retVal.diskUseZeroDbFS = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "diskZeroDbFS":
                    retVal.diskZeroDbFS = nodeVal;
                    break;
                case "useAudioOut":
                    retVal.useAudioOut = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "useAudioIn":
                    retVal.useAudioIn = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "useMidiIn":
                    retVal.useMidiIn = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "useMidiOut":
                    retVal.useMidiOut = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "noteAmpsEnabled":
                    retVal.noteAmpsEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "outOfRangeEnabled":
                    retVal.outOfRangeEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "warningsEnabled":
                    retVal.warningsEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "benchmarkEnabled":
                    retVal.benchmarkEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "advancedSettings":
                    retVal.advancedSettings = nodeVal;
                    break;
                case "completeOverride":
                    retVal.completeOverride = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "fileName":
                    retVal.fileName = nodeVal;
                    break;
                case "askOnRender":
                    retVal.askOnRender = Boolean.valueOf(nodeVal).booleanValue();
                    break;
                case "diskNoteAmpsEnabled":
                    retVal.diskNoteAmpsEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "diskOutOfRangeEnabled":
                    retVal.diskOutOfRangeEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "diskWarningsEnabled":
                    retVal.diskWarningsEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "diskBenchmarkEnabled":
                    retVal.diskBenchmarkEnabled = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "diskAdvancedSettings":
                    retVal.diskAdvancedSettings = nodeVal;
                    break;
                case "diskCompleteOverride":
                    retVal.diskCompleteOverride = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
                case "diskAlwaysRenderEntireProject":
                    retVal.diskAlwaysRenderEntireProject = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;

                case "mediaFolder":
                    retVal.mediaFolder = nodeVal;
                    break;
                case "copyToMediaFolderOnImport":
                    retVal.copyToMediaFileOnImport = Boolean.valueOf(nodeVal)
                            .booleanValue();
                    break;
            }

        }

        // Upgrade Migration for older values
        if (kr != null && kr.length() > 0 && retVal.ksmps != null
                && retVal.ksmps.length() == 0) {
            try {
                int ksmpsNum = Integer.parseInt(retVal.sampleRate)
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

        ValuesUtility.checkNullString(retVal);

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

        retVal.addElement("sampleRate").setText(sampleRate);
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
