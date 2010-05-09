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

import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.BufferedReader;
import java.io.File;
import java.io.Serializable;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import java.util.TreeMap;
import java.util.Vector;
import java.util.Map.Entry;

import Silence.XMLSerializer;
import blue.blueLive.LiveObject;
import blue.ftable.FTableSet;
import blue.midi.MidiInputProcessor;
import blue.mixer.Mixer;
import blue.noteProcessor.NoteProcessorChainMap;
import blue.orchestra.Instrument;
import blue.orchestra.InstrumentList;
import blue.score.tempo.Tempo;
import blue.soundObject.GenericScore;
import blue.soundObject.PolyObject;
import blue.soundObject.RepetitionObject;
import blue.soundObject.SoundObject;
import blue.udo.OpcodeList;
import blue.utility.ObjectUtilities;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * Main Data class for blue
 */

public class BlueData implements Serializable {

    private final transient Vector listeners = new Vector();

    private InstrumentLibrary instrumentLibrary = null; // No Longer in Use

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

    private PolyObject pObj;

    private ScratchPadData scratchData;

    private InstrumentList instrumentList;

    private float renderStartTime;

    private float renderEndTime;

    private MarkersList markersList;

    private boolean loopRendering;
    
    private Tempo tempo;

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

    //

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

        pObj = new PolyObject(true);

        liveData = new LiveData();

        tempo = new Tempo();

        midiInputProcessor = new MidiInputProcessor();
    }

    public PolyObject getPolyObject() {
        return pObj;
    }

    public void setPolyObject(PolyObject pObj) {
        this.pObj = pObj;
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

    /** *************************************** */

    /** *************************************** */

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

    public void upgradeData() {
        if (commandLine != null || title != null || author != null
                || notes != null || CsOptions != null || sampleRate != null
                || controlRate != null || channels != null
                || commandLine != null) {

            projectProperties.title = title;
            projectProperties.author = author;
            projectProperties.notes = notes;
            projectProperties.sampleRate = sampleRate;

            String ksmps = "1";

            try {
                int ksmpsNum = Integer.parseInt(sampleRate)
                        / Integer.parseInt(controlRate);
                ksmps = Integer.toString(ksmpsNum);
            } catch (NumberFormatException nfe) {

            }

            projectProperties.ksmps = ksmps;

            projectProperties.channels = channels;

            projectProperties.advancedSettings = commandLine;
            projectProperties.completeOverride = true;
        }

        projectProperties.upgradeData();

        commandLine = null;
        title = null;
        author = null;
        notes = null;
        CsOptions = null;
        sampleRate = null;
        controlRate = null;
        channels = null;
        commandLine = null;

        // for version 0.89.5, moving data to globalOrcSco

        if (this.globalScore != null) {
            this.globalOrcSco.setGlobalSco(this.globalScore);
        }
        this.globalScore = null;

        if (this.orchestra != null && this.orchestra.globals != null) {
            this.globalOrcSco.setGlobalOrc(this.orchestra.globals);
            this.orchestra.globals = null;
        }

        if (this.tables != null) {
            System.out.println("tables not null");
            this.tableSet.setTables(this.tables);
        }
        this.tables = null;

        // for 0.91.5, converting all repetitionObjects to genericScore

        convertRepetitionObjects(this.pObj);

        convertOrchestra();

        // fix for liveData object

        ArrayList liveDataObjects = this.liveData.getLiveSoundObjects();

        if (liveDataObjects.size() > 0) {
            if (liveDataObjects.get(0) instanceof SoundObject) {

                ArrayList temp = new ArrayList();

                Iterator iter = new ArrayList(liveDataObjects).iterator();

                while (iter.hasNext()) {
                    SoundObject sObj = (SoundObject) iter.next();
                    LiveObject liveObj = new LiveObject(sObj);

                    temp.add(liveObj);
                }

                this.liveData.setLiveSoundObjects(temp);
            }
        }
    }

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
        ArrayList soundObjects;
        Object tempSObj;
        SoundLayer sLayer;
        RepetitionObject repObj;
        GenericScore genScore;

        final int size = pObj.getSize();

        for (int i = 0; i < size; i++) {
            sLayer = (SoundLayer) pObj.getElementAt(i);

            soundObjects = sLayer.getSoundObjects();
            Iterator it = soundObjects.iterator();

            while (it.hasNext()) {
                tempSObj = it.next();
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

                    soundObjects.set(soundObjects.indexOf(repObj), genScore);
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
     * @param arrangement
     *            The arrangement to set.
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
     * @param instrumentLibrary
     *            The instrumentLibrary to set.
     */
    public void setInstrumentLibrary(InstrumentLibrary instrumentLibrary) {
        this.instrumentLibrary = instrumentLibrary;
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
        } else {
            XMLSerializer xmlSer = new XMLSerializer();
            BufferedReader xmlIn = new BufferedReader(new StringReader(text));

            tempData = (BlueData) xmlSer.read(xmlIn);

            xmlIn.close();
            tempData.upgradeData();
        }

        return tempData;
    }

    public static BlueData loadFromXML(Element data) throws Exception {
        BlueData blueData = new BlueData();

        Elements nodes = data.getElements();

        Element instrumentLibraryNode = null;
        Element arrangementNode = null;

        Mixer m = null;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("projectProperties")) {
                blueData.projectProperties = ProjectProperties
                        .loadFromXML(node);
            } else if (nodeName.equals("instrumentLibrary")) {
                instrumentLibraryNode = node;
            } else if (nodeName.equals("arrangement")) {
                arrangementNode = node;
            } else if (nodeName.equals("mixer")) {
                m = Mixer.loadFromXML(node);
            } else if (nodeName.equals("tables")) {
                blueData.tableSet = Tables.loadFromXML(node);
            } else if (nodeName.equals("soundObjectLibrary")) {
                blueData.sObjLib = SoundObjectLibrary.loadFromXML(node);
            } else if (nodeName.equals("globalOrcSco")) {
                blueData.globalOrcSco = GlobalOrcSco.loadFromXML(node);
            } else if (nodeName.equals("udo")) {
                // blueData.setUserDefinedOpcodes(node.getTextString());

                String udoText = node.getTextString();

                if (udoText == null) {
                    udoText = "";
                }

                OpcodeList results = UDOUtilities.parseUDOText(udoText);

                blueData.setOpcodeList(results);
            } else if (nodeName.equals("opcodeList")) {
                OpcodeList results = OpcodeList.loadFromXML(node);

                blueData.setOpcodeList(results);

            } else if (nodeName.equals("liveData")) {
                blueData.liveData = LiveData
                        .loadFromXML(node, blueData.sObjLib);
            } else if (nodeName.equals("soundObject")) {
                blueData.pObj = (PolyObject) ObjectUtilities.loadFromXML(data
                        .getElement("soundObject"), blueData.sObjLib);
            } else if (nodeName.equals("scratchPadData")) {
                blueData.scratchData = ScratchPadData.loadFromXML(node);
            } else if (nodeName.equals("noteProcessorChainMap")) {
                blueData.noteProcessorChainMap = NoteProcessorChainMap
                        .loadFromXML(node);
            } else if (nodeName.equals("renderStartTime")) {
                blueData.setRenderStartTime(Float.parseFloat(node
                        .getTextString()));
            } else if (nodeName.equals("renderEndTime")) {
                blueData.setRenderEndTime(Float
                        .parseFloat(node.getTextString()));
            } else if (nodeName.equals("markersList")) {
                blueData.setMarkersList(MarkersList.loadFromXML(node));
            } else if (nodeName.equals("loopRendering")) {
                blueData.setLoopRendering(node.getTextString()
                        .equalsIgnoreCase("true"));
            } else if (nodeName.equals("tempo")) {
                blueData.tempo = Tempo.loadFromXML(node);
            } else if (nodeName.equals("midiInputProcessor")) {
                blueData.midiInputProcessor = MidiInputProcessor.loadFromXML(
                        node);
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
        Element retVal = new Element("blueData");
        retVal.setAttribute("version", BlueConstants.getVersion());

        retVal.addElement(projectProperties.saveAsXML());
        // retVal.addElement(instrumentLibrary.saveAsXML());
        retVal.addElement(arrangement.saveAsXML());
        retVal.addElement(mixer.saveAsXML());
        retVal.addElement(tableSet.saveAsXML());
        retVal.addElement(sObjLib.saveAsXML());
        retVal.addElement(globalOrcSco.saveAsXML());
        // retVal.addElement("udo").setText(getUserDefinedOpcodes());

        retVal.addElement(opcodeList.saveAsXML());

        retVal.addElement(liveData.saveAsXML(sObjLib));
        retVal.addElement(pObj.saveAsXML(sObjLib));
        retVal.addElement(scratchData.saveAsXML());
        retVal.addElement(noteProcessorChainMap.saveAsXML());

        retVal.addElement("renderStartTime").setText(
                Float.toString(renderStartTime));
        retVal.addElement("renderEndTime").setText(
                Float.toString(renderEndTime));
        retVal.addElement(markersList.saveAsXML());
        retVal.addElement("loopRendering").setText(
                Boolean.toString(loopRendering));

        retVal.addElement(tempo.saveAsXML());
        retVal.addElement(midiInputProcessor.saveAsXML());
        
        return retVal;
    }

    /**
     * @return Returns the noteProcessorChainMap.
     */
    public NoteProcessorChainMap getNoteProcessorChainMap() {
        return noteProcessorChainMap;
    }

    /**
     * @param noteProcessorChainMap
     *            The noteProcessorChainMap to set.
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
    
    public Tempo getTempo() {
        return tempo;
    }
    
    public void setTempo(Tempo tempo) {
        this.tempo = tempo;
    }

    public MidiInputProcessor getMidiInputProcessor() {
        return midiInputProcessor;
    }
}