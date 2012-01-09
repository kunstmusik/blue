package blue.soundObject;

import blue.Arrangement;
import blue.GlobalOrcSco;
import blue.SoundObjectLibrary;
import blue.Tables;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.Serializable;

/**
 * DEPRECATED - GENERICSCORE WITH TIME BEHAVIOR OF REPEAT SHOULD BE USED
 */

public class RepetitionObject extends AbstractSoundObject implements
        Serializable, Cloneable, GenericEditable, GenericViewable {
//    private static BarRenderer renderer = new GenericRenderer();

    private String text = "; insert standard score here";

    private NoteProcessorChain npc = new NoteProcessorChain();

    public RepetitionObject() {
        this.setName("repetition");
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
        NoteList nl = new NoteList();
        NoteList objNotes;

        try {
            objNotes = ScoreUtilities.getNotes(text);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }

        float objDur = ScoreUtilities.getTotalDuration(objNotes);
        float subjDur = this.getSubjectiveDuration();

        float startVal = 0.0f;

        NoteList tempNL = null;

        if (objDur <= 0) {
            return nl;
        }

        while (startVal + objDur < subjDur) {
            tempNL = (NoteList) objNotes.clone();
            ScoreUtilities.setScoreStart(tempNL, startVal);
            nl.merge(tempNL);
            startVal += objDur;
        }

        tempNL = (NoteList) objNotes.clone();
        Note tempNote = null;

        float remainingDur = subjDur - startVal;

        for (int i = 0; i < tempNL.size(); i++) {
            tempNote = (Note) tempNL.getNote(i).clone();
            if (tempNote.getStartTime() + tempNote.getSubjectiveDuration() <= remainingDur) {
                tempNote.setStartTime(tempNote.getStartTime() + startVal);
                nl.addNote(tempNote);
            }
        }

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.setScoreStart(nl, this.getStartTime());

        return nl;
    }

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
    }

    public void generateFTables(Tables tables) {
    }

    public void generateInstruments(Arrangement arrangement) {
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public float getObjectiveDuration() {
        NoteList notes = null;
        try {
            notes = ScoreUtilities.getNotes(text);
        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (notes == null) {
            return 0;
        }

        return ScoreUtilities.getTotalDuration(notes);
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return this.npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

//    public SoundObjectEditor getEditor() {
//        return new GenericEditor();
//    }

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