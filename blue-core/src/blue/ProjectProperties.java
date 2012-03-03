package blue;

import blue.utility.ObjectUtilities;
import blue.utility.ValuesUtility;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

public final class ProjectProperties implements Serializable, Cloneable {
    /*
     * private String title; private String author; private String notes;
     * private String CsOptions; private String sampleRate, controlRate,
     * channels; private String commandLine;
     */

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

    public String CsOptions = null; // for legacy data
    public String controlRate = null; // to be removed
    public String commandLine = null; // to be removed
    public String diskCommandLine = null; // to be removed

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
    
    public ProjectProperties() {
        /*
         * title = ""; author = ""; notes = ""; sampleRate = "44100";
         * controlRate = "22050"; channels = "2"; CsOptions = ""; commandLine =
         * "csound";
         */
    }

    public String getKsmps() {
        // int sr = Integer.parseInt(sampleRate.trim());
        // int kr = Integer.parseInt(controlRate.trim());
        // return Integer.toString(sr / kr);
        return ksmps;
    }

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

            if (nodeName.equals("title")) {
                retVal.title = nodeVal;
            } else if (nodeName.equals("author")) {
                retVal.author = nodeVal;
            } else if (nodeName.equals("notes")) {
                retVal.notes = nodeVal;
            } else if (nodeName.equals("sampleRate")) {
                retVal.sampleRate = nodeVal;
            } else if (nodeName.equals("controlRate")) {
                kr = nodeVal;
            } else if (nodeName.equals("ksmps")) {
                retVal.ksmps = nodeVal;
            } else if (nodeName.equals("useZeroDbFS")) {
                retVal.useZeroDbFS = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("zeroDbFS")) {
                retVal.zeroDbFS = nodeVal;
            } else if (nodeName.equals("channels")) {
                retVal.channels = nodeVal;
            } else if (nodeName.equals("commandLine")) {
                commandLine = nodeVal;
            } else if (nodeName.equals("diskSampleRate")) {
                retVal.diskSampleRate = nodeVal;
            } else if (nodeName.equals("diskKsmps")) {
                retVal.diskKsmps = nodeVal;
            } else if (nodeName.equals("diskChannels")) {
                retVal.diskChannels = nodeVal;
            } else if (nodeName.equals("diskCommandLine")) {
                diskCommandLine = nodeVal;
            } else if (nodeName.equals("diskUseZeroDbFS")) {
                retVal.diskUseZeroDbFS = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("diskZeroDbFS")) {
                retVal.diskZeroDbFS = nodeVal;
            } else if (nodeName.equals("useAudioOut")) {
                retVal.useAudioOut = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("useAudioIn")) {
                retVal.useAudioIn = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("useMidiIn")) {
                retVal.useMidiIn = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("useMidiOut")) {
                retVal.useMidiOut = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("noteAmpsEnabled")) {
                retVal.noteAmpsEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("outOfRangeEnabled")) {
                retVal.outOfRangeEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("warningsEnabled")) {
                retVal.warningsEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("benchmarkEnabled")) {
                retVal.benchmarkEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("advancedSettings")) {
                retVal.advancedSettings = nodeVal;
            } else if (nodeName.equals("completeOverride")) {
                retVal.completeOverride = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("fileName")) {
                retVal.fileName = nodeVal;
            } else if (nodeName.equals("askOnRender")) {
                retVal.askOnRender = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("diskNoteAmpsEnabled")) {
                retVal.diskNoteAmpsEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("diskOutOfRangeEnabled")) {
                retVal.diskOutOfRangeEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("diskWarningsEnabled")) {
                retVal.diskWarningsEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("diskBenchmarkEnabled")) {
                retVal.diskBenchmarkEnabled = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("diskAdvancedSettings")) {
                retVal.diskAdvancedSettings = nodeVal;
            } else if (nodeName.equals("diskCompleteOverride")) {
                retVal.diskCompleteOverride = Boolean.valueOf(nodeVal)
                        .booleanValue();
            } else if (nodeName.equals("diskAlwaysRenderEntireProject")) {
                retVal.diskAlwaysRenderEntireProject = Boolean.valueOf(nodeVal)
                        .booleanValue();
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
        
        return retVal;
    }

    /* For upgrading from older projects
     */

    public void upgradeData() {
        if(commandLine != null && advancedSettings.length() == 0) {
            advancedSettings = commandLine;
            completeOverride = true;
            commandLine = null;
        }

        if(controlRate != null) {
            try {
                int val = Integer.parseInt(sampleRate) / Integer.parseInt(controlRate);
                ksmps = Integer.toString(val);
            } catch(Exception e) {
                // ignore
            }
            controlRate = null;
        }

        if(CsOptions != null) {
            advancedSettings = CsOptions;
            CsOptions = null;
        }

        if(diskCommandLine != null && diskAdvancedSettings.length() == 0) {
            diskAdvancedSettings = diskCommandLine;
            diskCompleteOverride = true;
            diskCommandLine = null;
        }
    }

    @Override
    public ProjectProperties clone() {
        return (ProjectProperties) ObjectUtilities.clone(this);
    }
}