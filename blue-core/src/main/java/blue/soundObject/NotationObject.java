package blue.soundObject;

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.soundObject.notation.NotationStaff;
import electric.xml.Element;
import java.util.Map;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 *
 * @author unascribed
 * @version 1.0
 */
public class NotationObject extends AbstractSoundObject implements
        GenericViewable {
//    private static BarRenderer renderer = new GenericRenderer();

    private NoteProcessorChain npc = new NoteProcessorChain();

    private TimeBehavior timeBehavior;

    private final NotationStaff staff;

    public NotationObject() {
        name = "Notation Object";
        subjectiveDuration = 2.0f;
        startTime = 0.0f;
        timeBehavior = TimeBehavior.SCALE;
        staff = new NotationStaff();
    }

    public NotationObject(NotationObject nObj) {
        super(nObj);
        npc = new NoteProcessorChain(nObj.npc);
        timeBehavior = nObj.timeBehavior;
        staff = new NotationStaff(nObj.staff);
    }

    /*
     * public void generateInstruments(Orchestra orch) { }
     */
    public void generateGlobals(GlobalOrcSco globalOrcSco) {
    }

    public void generateFTables(Tables tables) {
    }

    public void generateInstruments(Arrangement arrangement) {
    }

    @Override
    public double getObjectiveDuration() {
        return this.getSubjectiveDuration();
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }
    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    public NoteList generateNotes(double renderStart, double renderEnd) {
        /**
         * @todo: Implement this blue.soundObject.SoundObject method
         */
        // get notes from notationNoteList, ignore rests
        // apply note chain
        throw new java.lang.UnsupportedOperationException(
                "Method generateNotes() not yet implemented.");
    }

    public NotationStaff getNotationStaff() {
        return staff;
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
        return -1.0f;
    }

    @Override
    public void setRepeatPoint(double repeatPoint) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public SoundObject loadFromXML(Element data, Map<String, Object> objRefMap) {
        // TODO Auto-generated method stub
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime, double endTime) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public SoundObject deepCopy() {
        return new NotationObject(this);
    }

}
