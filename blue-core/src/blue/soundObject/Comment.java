package blue.soundObject;

import blue.Arrangement;
import blue.GlobalOrcSco;
import blue.SoundObjectLibrary;
import blue.Tables;
import blue.noteProcessor.NoteProcessorChain;
import electric.xml.Element;
import java.io.Serializable;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class Comment extends AbstractSoundObject implements Serializable,
        Cloneable, GenericEditable {

//    private static BarRenderer renderer = new CommentRenderer();

    private String commentText;

    public Comment() {
        commentText = "";
        this.setName("Comment");
    }

    public String getText() {
        return this.commentText;
    }

    public void setText(String text) {
        this.commentText = text;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public float getObjectiveDuration() {
        return this.getSubjectiveDuration();
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }
//
//    public SoundObjectEditor getEditor() {
//        return new GenericEditor();
//    }

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
    }

    public void generateFTables(Tables tables) {
    }

    public NoteList generateNotes(float renderStart, float renderEnd) {
        return null;
    }

    /*
     * public void generateInstruments(Orchestra parm1) { return; }
     */

    public void generateInstruments(Arrangement arrangement) {
        return;
    }

    public int getTimeBehavior() {
        return SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED;
    }

    public void setTimeBehavior(int timeBehavior) {
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
    public static SoundObject loadFromXML(Element data,
            SoundObjectLibrary sObjLibrary) throws Exception {
        Comment comment = new Comment();

        SoundObjectUtilities.initBasicFromXML(data, comment);

        comment.setText(data.getElement("commentText").getTextString());

        return comment;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("commentText").setText(this.getText());

        return retVal;
    }
}