package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.score.ScoreObject;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.Serializable;
import java.util.Map;

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


    public void processNotes(NoteList nl) throws SoundObjectException {
        
        ScoreUtilities.normalizeNoteList(nl);

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);

    }

    @Override
    public float getObjectiveDuration() {
        return sObj.getSubjectiveDuration();
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain npc) {
        this.npc = npc;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    /*
     * public Object clone() { Instance inst = new Instance(); inst.sObj =
     * this.sObj; inst.setName(this.getName()); return inst; }
     */

    @Override
    public SoundObject clone() {
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

    @Override
    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public float getRepeatPoint() {
        return this.repeatPoint;
    }

    @Override
    public void setRepeatPoint(float repeatPoint) {
        this.repeatPoint = repeatPoint;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.REPEAT_POINT);

        fireScoreObjectEvent(event);
    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        Instance instance = new Instance();

        SoundObjectUtilities.initBasicFromXML(data, instance);

        String id = data.getElement("soundObjectReference")
                .getAttributeValue("soundObjectLibraryID");

        if("null".equals(id)) {
            throw new Exception("ERROR: SoundObject Instance found pointing to an library item that no longer exists");
        }
        
        Object sObj = objRefMap.get(id);
        if(sObj != null) {
            instance.setSoundObject((SoundObject)sObj);
        } else {
            throw new Exception("Could not find SoundObject pointed to from Instance with ID: " + id);
        }

        return instance;

    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("soundObjectReference").setAttribute(
                "soundObjectLibraryID",
                objRefMap.get(this
                        .getSoundObject()));

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

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime)
    throws SoundObjectException {
        NoteList nl = sObj.generateForCSD(compileData, startTime, endTime);
        processNotes(nl);
        
        return nl;
    }
}