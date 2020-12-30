package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.util.Map;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public class Instance extends AbstractSoundObject {

//    private static BarRenderer renderer = new LetterRenderer("I");
    private SoundObject sObj;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0f;

    /*
     * cache library id when loading up the SoundObjectLibrary, to be resolved
     * in second pass
     * FIXME: THIS NEEDS TO BE REPLACED!
     */
    int soundObjectLibraryId = -1;

    public Instance(SoundObject sObj) {
        this.sObj = sObj;
        setName(sObj.getName());
        this.setBackgroundColor(sObj.getBackgroundColor());
        timeBehavior = TimeBehavior.SCALE;
    }

    public Instance() {
        this.name = "Instance: ";
    }

    /**
     * Copy Constructor NOTE: intentionally keeps same SoundObject reference in
     * copy as original
     *
     * @param instance
     */
    public Instance(Instance instance) {
        super(instance);
        sObj = instance.sObj;
        npc = new NoteProcessorChain(instance.npc);
        backgroundColor = instance.getBackgroundColor();
        timeBehavior = instance.getTimeBehavior();
        repeatPoint = instance.repeatPoint;
    }

    public void processNotes(NoteList nl) throws SoundObjectException {

        ScoreUtilities.normalizeNoteList(nl);

        try {
           nl =  ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);

    }

    @Override
    public double getObjectiveDuration() {
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

    @Override
    public TimeBehavior getTimeBehavior() {
        return this.timeBehavior;
    }

    @Override
    public void setTimeBehavior(TimeBehavior timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public double getRepeatPoint() {
        return this.repeatPoint;
    }

    @Override
    public void setRepeatPoint(double repeatPoint) {
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

        if ("null".equals(id)) {
            throw new Exception("ERROR: SoundObject Instance found pointing to an library item that no longer exists");
        }

        Object sObj = objRefMap.get(id);
        if (sObj != null) {
            instance.setSoundObject((SoundObject) sObj);
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
     * @param obj The sObj to set.
     */
    public void setSoundObject(SoundObject obj) {
        sObj = obj;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime, double endTime)
            throws SoundObjectException {
        NoteList nl = sObj.generateForCSD(compileData, startTime, endTime);
        processNotes(nl);

        return nl;
    }

    @Override
    public Instance deepCopy() {
        return new Instance(this);
    }
}
