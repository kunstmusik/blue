/*
 * blue - object composition environment for csound Copyright (c) 2001-2003
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
package blue;

import blue.data.BlueDataObjectManager;
import blue.ftable.FTableSet;
import blue.midi.MidiInputProcessor;
import blue.mixer.Mixer;
import blue.noteProcessor.NoteProcessorChainMap;
import blue.orchestra.Instrument;
import blue.orchestra.InstrumentList;
import blue.score.Score;
import blue.soundObject.GenericScore;
import blue.soundObject.PolyObject;
import blue.soundObject.RepetitionObject;
import blue.soundObject.SoundObject;
import blue.udo.OpcodeList;
import blue.upgrades.UpgradeManager;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Attribute;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.BufferedReader;
import java.io.File;
import java.io.Serializable;
import java.io.StringReader;
import java.util.*;
import java.util.Map.Entry;
import org.openide.util.Lookup;

/**
 * Main Data class for blue
 */
public class BlueData implements Serializable, BlueDataObject {

    private final transient Vector listeners = new Vector();

    private InstrumentLibrary instrumentLibrary = null; // No Longer in Use

    private String version;

    private Arrangement arrangement;

    private Mixer mixer;

    private ProjectProperties projectProperties;

    private final FTableSet ftables;

    private SoundObjectLibrary sObjLib;

    private GlobalOrcSco globalOrcSco;

    private NoteProcessorChainMap noteProcessorChainMap;

    private Tables tableSet;

    // ^ temporary, until FTableSet is made and worked out
    // private String userDefinedOpcodes = "";
    private OpcodeList opcodeList;

    private LiveData liveData;

    private Score score;

    private ScratchPadData scratchData;

    private InstrumentList instrumentList;

    private float renderStartTime;

    private float renderEndTime;

    private MarkersList markersList;

    private boolean loopRendering;

    // all of this left here for compatibility's sake;
    // no longer being used (moved to ProjectProperties class)
    private String title;

    private String author;

    private String notes;

    private String CsOptions;

    private String sampleRate, controlRate, channels;

    private String commandLine;

    private MidiInputProcessor midiInputProcessor;

    // refactored out to GlobalOrcSco, left in for compatibilty (ver 0.89.5)
    private String globalScore;

    // left for compatibility, should be moved into FTableSet
    // refactored out to blue.Tables, left in for compatibilty (ver 0.89.6)
    private String tables;

    // Converted over to using InstrumentLibrary/Arrangement (ver 0.94.0)
    private Orchestra orchestra;

    /** Holds data for ProjectPlugins */
    private List<BlueDataObject> pluginData;

    public BlueData() {
        // orchestra = new Orchestra();
        arrangement = new Arrangement();
        mixer = new Mixer();
        // instrumentLibrary = new InstrumentLibrary();

        ftables = new FTableSet();
        projectProperties = new ProjectProperties();
        sObjLib = new SoundObjectLibrary();
        globalOrcSco = new GlobalOrcSco();
        tableSet = new Tables();

        opcodeList = new OpcodeList();

        noteProcessorChainMap = new NoteProcessorChainMap();

        scratchData = new ScratchPadData();

        renderStartTime = 0.0f;
        renderEndTime = -1.0f;
        markersList = new MarkersList();
        loopRendering = false;

        score = new Score();
//        score.addLayerGroup(new PolyObject());

        liveData = new LiveData();

        midiInputProcessor = new MidiInputProcessor();

        pluginData = new ArrayList<>();
    }

    /**
     * @return the version
     */
    public String getVersion() {
        return version;
    }

    /**
     * @param version the version to set
     */
    public void setVersion(String version) {
        this.version = version;
    }

    public Score getScore() {
        return score;
    }

    public Orchestra getOrchestra() {
        return orchestra;
    }

    public void setOrchestra(Orchestra orch) {
        orchestra = orch;
    }

    public ScratchPadData getScratchPadData() {
        return this.scratchData;
    }

    public void setScratchPadData(ScratchPadData scratchData) {
        this.scratchData = scratchData;
    }

    public LiveData getLiveData() {
        return this.liveData;
    }

    /**
     * ***************************************
     */
    /**
     * ***************************************
     */
    public SoundObjectLibrary getSoundObjectLibrary() {
        return sObjLib;
    }

    public void setSoundObjectLibrary(SoundObjectLibrary sObjLib) {
        this.sObjLib = sObjLib;
    }

    public ProjectProperties getProjectProperties() {
        return projectProperties;
    }

    public void setProjectProperties(ProjectProperties projectProperties) {
        this.projectProperties = projectProperties;
    }

    public GlobalOrcSco getGlobalOrcSco() {
        return this.globalOrcSco;
    }

    public void setGlobalOrcSco(GlobalOrcSco globalOrcSco) {
        this.globalOrcSco = globalOrcSco;
    }

    // FIXME - ensure upgradeData info is taken into account when developing
    // upgrader after 2.7.0
//    public void upgradeData() {
//        if (commandLine != null || title != null || author != null
//                || notes != null || CsOptions != null || sampleRate != null
//                || controlRate != null || channels != null
//                || commandLine != null) {
//
//            projectProperties.title = title;
//            projectProperties.author = author;
//            projectProperties.notes = notes;
//            projectProperties.sampleRate = sampleRate;
//
//            String ksmps = "1";
//
//            try {
//                int ksmpsNum = Integer.parseInt(sampleRate)
//                        / Integer.parseInt(controlRate);
//                ksmps = Integer.toString(ksmpsNum);
//            } catch (NumberFormatException nfe) {
//
//            }
//
//            projectProperties.ksmps = ksmps;
//
//            projectProperties.channels = channels;
//
//            projectProperties.advancedSettings = commandLine;
//            projectProperties.completeOverride = true;
//        }
//
//        projectProperties.upgradeData();
//
//        commandLine = null;
//        title = null;
//        author = null;
//        notes = null;
//        CsOptions = null;
//        sampleRate = null;
//        controlRate = null;
//        channels = null;
//        commandLine = null;
//
//        // for version 0.89.5, moving data to globalOrcSco
//        if (this.globalScore != null) {
//            this.globalOrcSco.setGlobalSco(this.globalScore);
//        }
//        this.globalScore = null;
//
//        if (this.orchestra != null && this.orchestra.globals != null) {
//            this.globalOrcSco.setGlobalOrc(this.orchestra.globals);
//            this.orchestra.globals = null;
//        }
//
//        if (this.tables != null) {
//            System.out.println("tables not null");
//            this.tableSet.setTables(this.tables);
//        }
//        this.tables = null;
//
//        // for 0.91.5, converting all repetitionObjects to genericScore
////        convertRepetitionObjects(this.pObj);
//        convertOrchestra();
//
//    }

    /**
     * Added in 0.95.0 for converting Arrangement to not depend on references to
     * instrument in project Instrument
     */
    public void normalizeArrangement() {
        arrangement.normalize();
    }

    /**
     * Added in 0.94.0 for converting Orchestra to InstrumentLibrary/Arrangement
     */
    private void convertOrchestra() {
        if (this.orchestra == null) {
            return;
        }

        TreeMap tree = orchestra.orch;

        for (Iterator iter = tree.entrySet().iterator(); iter.hasNext();) {
            Map.Entry entry = (Entry) iter.next();

            Integer key = (Integer) entry.getKey();
            Instrument instr = (Instrument) entry.getValue();
            // instrumentLibrary.getRootInstrumentCategory().addInstrument(instr);

            if (instr.isEnabled()) {
                arrangement.insertInstrument(key.toString(), instr);
            }
        }

        this.orchestra = null;
    }

    // ADDED IN 0.91.5 FOR CONVERTING REPETITION OBJECTS TO GENERIC SCORE
    private void convertRepetitionObjects(PolyObject pObj) {
        RepetitionObject repObj;
        GenericScore genScore;

        for (SoundLayer sLayer : pObj) {

            for (SoundObject tempSObj : sLayer) {
                if (tempSObj instanceof PolyObject) {
                    convertRepetitionObjects((PolyObject) tempSObj);
                } else if (tempSObj instanceof RepetitionObject) {
                    repObj = (RepetitionObject) tempSObj;
                    genScore = new GenericScore();
                    genScore.setText(repObj.getText());
                    genScore.setTimeBehavior(SoundObject.TIME_BEHAVIOR_REPEAT);
                    genScore.setStartTime(repObj.getStartTime());
                    genScore.setSubjectiveDuration(repObj
                            .getSubjectiveDuration());
                    genScore.setName(repObj.getName());

                    sLayer.set(sLayer.indexOf(repObj), genScore);
                }
            }
        }
    }

    public Tables getTableSet() {
        return tableSet;
    }

    public void setTableSet(Tables tableSet) {
        this.tableSet = tableSet;
    }

    /**
     * @return Returns the arrangement.
     */
    public Arrangement getArrangement() {
        return arrangement;
    }

    /**
     * @param arrangement The arrangement to set.
     */
    public void setArrangement(Arrangement arrangement) {
        this.arrangement = arrangement;
    }

    /**
     * @return Returns the instrumentLibrary.
     */
    public InstrumentLibrary getInstrumentLibrary() {
        return instrumentLibrary;
    }

    /**
     * @param instrumentLibrary The instrumentLibrary to set.
     */
    public void setInstrumentLibrary(InstrumentLibrary instrumentLibrary) {
        this.instrumentLibrary = instrumentLibrary;
    }

    public List<BlueDataObject> getPluginData() {
        return pluginData;
    }

    /**
     * Utility method to load BlueData from File; does not alert user if upgrade
     * happened from pre 0.94.0 file. Useful for scripting.
     *
     * @param f
     * @return
     * @throws Exception
     */
    public static BlueData load(File f) throws Exception {
        String text = TextUtilities.getTextFromFile(f);

        BlueData tempData = null;

        if (text.startsWith("<blueData")) {
            Document d = new Document(text);
            tempData = BlueData.loadFromXML(d.getElement("blueData"));
        } 
// FIXME - Dead Code
//        else {
//            XMLSerializer xmlSer = new XMLSerializer();
//            try (BufferedReader xmlIn = new BufferedReader(new StringReader(text))) {
//                tempData = (BlueData) xmlSer.read(xmlIn);
//            }
//            tempData.upgradeData();
//        }

        return tempData;
    }

    public static BlueData loadFromXML(Element data) throws Exception {

        UpgradeManager.getInstance().performUpgrades(data);

        BlueData blueData = new BlueData();

        Map<String, Object> objRefMap = new HashMap<>();

        Elements nodes = data.getElements();

        Element instrumentLibraryNode = null;
        Element arrangementNode = null;

        Mixer m = null;

        Attribute versionAttribute = data.getAttribute("version");
        if (versionAttribute != null) {
            blueData.setVersion(versionAttribute.getValue());
        }

        BlueDataObjectManager bdoManager = Lookup.getDefault().
                lookup(BlueDataObjectManager.class);

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "projectProperties":
                    blueData.projectProperties = ProjectProperties
                            .loadFromXML(node);
                    break;
                case "instrumentLibrary":
                    instrumentLibraryNode = node;
                    break;
                case "arrangement":
                    arrangementNode = node;
                    break;
                case "mixer":
                    m = Mixer.loadFromXML(node);
                    break;
                case "tables":
                    blueData.tableSet = Tables.loadFromXML(node);
                    break;
                case "soundObjectLibrary":
                    blueData.sObjLib = SoundObjectLibrary.loadFromXML(node, objRefMap);
                    break;
                case "globalOrcSco":
                    blueData.globalOrcSco = GlobalOrcSco.loadFromXML(node);
                    break;
                case "udo": {
                    // blueData.setUserDefinedOpcodes(node.getTextString());
                    String udoText = node.getTextString();
                    if (udoText == null) {
                        udoText = "";
                    }
                    OpcodeList results = UDOUtilities.parseUDOText(udoText);
                    blueData.setOpcodeList(results);
                    break;
                }
                case "opcodeList": {
                    OpcodeList results = OpcodeList.loadFromXML(node);
                    blueData.setOpcodeList(results);
                    break;
                }
                case "liveData":
                    blueData.liveData = LiveData
                            .loadFromXML(node, objRefMap);
                    break;
                case "score":
                    blueData.score = Score.loadFromXML(node, objRefMap);
                    break;
                case "scratchPadData":
                    blueData.scratchData = ScratchPadData.loadFromXML(node);
                    break;
                case "noteProcessorChainMap":
                    blueData.noteProcessorChainMap = NoteProcessorChainMap
                            .loadFromXML(node);
                    break;
                case "renderStartTime":
                    blueData.setRenderStartTime(Float.parseFloat(node
                            .getTextString()));
                    break;
                case "renderEndTime":
                    blueData.setRenderEndTime(Float
                            .parseFloat(node.getTextString()));
                    break;
                case "markersList":
                    blueData.setMarkersList(MarkersList.loadFromXML(node));
                    break;
                case "loopRendering":
                    blueData.setLoopRendering(node.getTextString()
                            .equalsIgnoreCase("true"));
                    break;
                case "midiInputProcessor":
                    blueData.midiInputProcessor = MidiInputProcessor.loadFromXML(
                            node);
                    break;
                case "pluginData":
                    Elements pluginElems = node.getElements();
                    while (pluginElems.hasMoreElements()) {
                        blueData.pluginData.add(bdoManager.loadFromXML(
                                pluginElems.next()));
                    }
                    break;
            }

        }

        if (instrumentLibraryNode != null) {
            blueData.instrumentLibrary = InstrumentLibrary
                    .loadFromXML(instrumentLibraryNode);
            blueData.arrangement = Arrangement.loadFromXML(arrangementNode,
                    blueData.instrumentLibrary);
        } else {
            blueData.arrangement = Arrangement.loadFromXML(arrangementNode);
        }

        if (m != null) {
            blueData.mixer = m;
        } else {
            blueData.mixer.setEnabled(false);
        }

        return blueData;
    }

    public Element saveAsXML() {

        // update version
        this.version = BlueConstants.getVersion();

        Map<Object, String> objRefMap = new HashMap<>();

        Element retVal = new Element("blueData");
        retVal.setAttribute("version", BlueConstants.getVersion());

        retVal.addElement(projectProperties.saveAsXML());
        // retVal.addElement(instrumentLibrary.saveAsXML());
        retVal.addElement(arrangement.saveAsXML());
        retVal.addElement(mixer.saveAsXML());
        retVal.addElement(tableSet.saveAsXML());
        retVal.addElement(sObjLib.saveAsXML(objRefMap));
        retVal.addElement(globalOrcSco.saveAsXML());
        // retVal.addElement("udo").setText(getUserDefinedOpcodes());

        retVal.addElement(opcodeList.saveAsXML());

        retVal.addElement(liveData.saveAsXML(objRefMap));
        retVal.addElement(score.saveAsXML(objRefMap));
        retVal.addElement(scratchData.saveAsXML());
        retVal.addElement(noteProcessorChainMap.saveAsXML());

        retVal.addElement("renderStartTime").setText(
                Float.toString(renderStartTime));
        retVal.addElement("renderEndTime").setText(
                Float.toString(renderEndTime));
        retVal.addElement(markersList.saveAsXML());
        retVal.addElement("loopRendering").setText(
                Boolean.toString(loopRendering));

        retVal.addElement(midiInputProcessor.saveAsXML());

        Element pluginElems = retVal.addElement("pluginData");

        for (BlueDataObject bdoObj : pluginData) {
            pluginElems.addElement(bdoObj.saveAsXML());
        }

        return retVal;
    }

    /**
     * @return Returns the noteProcessorChainMap.
     */
    public NoteProcessorChainMap getNoteProcessorChainMap() {
        return noteProcessorChainMap;
    }

    /**
     * @param noteProcessorChainMap The noteProcessorChainMap to set.
     */
    public void setNoteProcessorChainMap(
            NoteProcessorChainMap noteProcessorChainMap) {
        this.noteProcessorChainMap = noteProcessorChainMap;
    }

    public float getRenderStartTime() {
        return renderStartTime;
    }

    public void setRenderStartTime(float renderStartTime) {

        if (renderStartTime == this.renderStartTime) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this,
                "renderStartTime", new Float(this.renderStartTime), new Float(
                        renderStartTime));

        this.renderStartTime = renderStartTime;

        firePropertyChangeEvent(pce);

        if (renderStartTime >= this.renderEndTime) {
            PropertyChangeEvent pce2 = new PropertyChangeEvent(this,
                    "renderLoopTime", new Float(this.renderEndTime), new Float(
                            -1.0f));

            this.renderEndTime = -1.0f;

            firePropertyChangeEvent(pce2);
        }
    }

    public float getRenderEndTime() {
        return renderEndTime;
    }

    public void setRenderEndTime(float renderLoopTime) {

        float newRenderLoopTime = renderLoopTime;

        if (renderLoopTime <= this.renderStartTime) {
            newRenderLoopTime = -1.0f;
        }

        if (newRenderLoopTime == this.renderEndTime) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this,
                "renderLoopTime", new Float(this.renderEndTime), new Float(
                        newRenderLoopTime));

        this.renderEndTime = newRenderLoopTime;

        firePropertyChangeEvent(pce);
    }

    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null || listeners.size() == 0) {
            return;
        }

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        listeners.remove(pcl);
    }

    public boolean isLoopRendering() {
        return loopRendering;
    }

    public void setLoopRendering(boolean loopRendering) {

        boolean oldVal = this.loopRendering;

        PropertyChangeEvent pce = new PropertyChangeEvent(this,
                "loopRendering", Boolean.valueOf(oldVal), Boolean
                .valueOf(loopRendering));

        this.loopRendering = loopRendering;

        firePropertyChangeEvent(pce);
    }

    public OpcodeList getOpcodeList() {
        return opcodeList;
    }

    public void setOpcodeList(OpcodeList opcodeList) {
        this.opcodeList = opcodeList;
    }

    public MarkersList getMarkersList() {
        return markersList;
    }

    public void setMarkersList(MarkersList markersList) {
        this.markersList = markersList;
    }

    public Mixer getMixer() {
        return mixer;
    }

    public void setMixer(Mixer mixer) {
        this.mixer = mixer;
    }

    public MidiInputProcessor getMidiInputProcessor() {
        return midiInputProcessor;
    }

}
