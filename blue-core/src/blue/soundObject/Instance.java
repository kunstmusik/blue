package blue.soundObject;

import blue.Arrangement;
import blue.GlobalOrcSco;
import blue.SoundObjectLibrary;
import blue.Tables;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.Serializable;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

public class Instance extends AbstractSoundObject implements Serializable {

//    private static BarRenderer renderer = new LetterRenderer("I");

    private SoundObject sObj;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    /*
     * cache library id when loading up the SoundObjectLibrary, to be resolved
     * in second pass
     */
    int soundObjectLibraryId = -1;

    public Instance(SoundObject sObj) {
        this.sObj = sObj;
        setName(sObj.getName());
        this.setBackgroundColor(sObj.getBackgroundColor());
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public Instance() {
        this.name = "Instance: ";
    }

//    public SoundObjectEditor getEditor() {
//        return new InstanceEditor();
//    }

    private void prepareCompilation() {
        this.sObj = (SoundObject) sObj.clone();
    }

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
        prepareCompilation();

        sObj.generateGlobals(globalOrcSco);
    }

    public void generateFTables(Tables tables) {
        sObj.generateFTables(tables);
    }

    public void generateInstruments(Arrangement arr) {
        sObj.generateInstruments(arr);
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
        NoteList nl;

        try {
            nl = sObj.generateNotes(0.0f, -1.0f);
        } catch (SoundObjectException e) {
            throw new SoundObjectException(this, e);
        }
        ScoreUtilities.normalizeNoteList(nl);

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);

        return nl;
    }

    public float getObjectiveDuration() {
        return sObj.getSubjectiveDuration();
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        this.npc = npc;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    /*
     * public Object clone() { Instance inst = new Instance(); inst.sObj =
     * this.sObj; inst.setName(this.getName()); return inst; }
     */

    public Object clone() {
        SoundObject librarySObj = this.getSoundObject();

        this.setSoundObject(null);
        Instance retVal = (Instance) ObjectUtilities.clone(this);

        this.setSoundObject(librarySObj);
        retVal.setSoundObject(librarySObj);

        return retVal;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    public float getRepeatPoint() {
        return this.repeatPoint;
    }

    public void setRepeatPoint(float repeatPoint) {
        this.repeatPoint = repeatPoint;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.REPEAT_POINT);

        fireSoundObjectEvent(event);
    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            SoundObjectLibrary sObjLibrary) throws Exception {
        Instance instance = new Instance();

        SoundObjectUtilities.initBasicFromXML(data, instance);

        int id = Integer.parseInt(data.getElement("soundObjectReference")
                .getAttributeValue("soundObjectLibraryID"));

        if (sObjLibrary.isInitializing()) {
            instance.soundObjectLibraryId = id;
        } else {
            instance.setSoundObject(sObjLibrary.getSoundObjectByID(id));
        }

        return instance;

    }

    public void resolve(SoundObjectLibrary sObjLibrary) {
        if (soundObjectLibraryId < 0) {
            System.err.println("Error: Could not resolve Instance SoundObject");
        } else {
            setSoundObject(sObjLibrary.getSoundObjectByID(soundObjectLibraryId));
            soundObjectLibraryId = -1;
        }
    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("soundObjectReference").setAttribute(
                "soundObjectLibraryID",
                Integer.toString(sObjLibrary.getSoundObjectLibraryID(this
                        .getSoundObject())));

        return retVal;
    }

    /**
     * @return Returns the sObj.
     */
    public SoundObject getSoundObject() {
        return sObj;
    }

    /**
     * @param obj
     *            The sObj to set.
     */
    public void setSoundObject(SoundObject obj) {
        sObj = obj;
    }
}