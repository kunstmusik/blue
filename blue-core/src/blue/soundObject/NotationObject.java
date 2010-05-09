package blue.soundObject;

import java.io.Serializable;

import blue.Arrangement;
import blue.GlobalOrcSco;
import blue.SoundObjectLibrary;
import blue.Tables;
import blue.noteProcessor.NoteProcessorChain;
import blue.soundObject.notation.NotationStaff;
import electric.xml.Element;

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
        Serializable, Cloneable, GenericViewable {
//    private static BarRenderer renderer = new GenericRenderer();

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    private NotationStaff staff = new NotationStaff();

    public NotationObject() {
        name = "Notation Object";
        subjectiveDuration = 2.0f;
        startTime = 0.0f;
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

//    public SoundObjectEditor getEditor() {
//        return new NotationEditor();
//    }

    /*
     * public void generateInstruments(Orchestra orch) { }
     */

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
    }

    public void generateFTables(Tables tables) {
    }

    public void generateInstruments(Arrangement arrangement) {
    }

    public float getObjectiveDuration() {
        return this.getSubjectiveDuration();
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    public NoteList generateNotes(float renderStart, float renderEnd) {
        /** @todo: Implement this blue.soundObject.SoundObject method */
        // get notes from notationNoteList, ignore rests
        // apply note chain
        throw new java.lang.UnsupportedOperationException(
                "Method generateNotes() not yet implemented.");
    }

    public NotationStaff getNotationStaff() {
        return staff;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#getTimeBehavior()
     */
    public int getTimeBehavior() {
        // TODO Auto-generated method stub
        return 0;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#setTimeBehavior(int)
     */
    public void setTimeBehavior(int timeBehavior) {
        // TODO Auto-generated method stub

    }

    public float getRepeatPoint() {
        return -1.0f;
    }

    public void setRepeatPoint(float repeatPoint) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public SoundObject loadFromXML(Element data, SoundObjectLibrary sObjLibrary) {
        // TODO Auto-generated method stub
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        // TODO Auto-generated method stub
        return null;
    }

}