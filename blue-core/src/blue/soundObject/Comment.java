package blue.soundObject;

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.plugin.SoundObjectPlugin;
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

@SoundObjectPlugin(displayName = "Comment", live=false, position = 20)
public class Comment extends AbstractSoundObject implements Serializable,
        Cloneable {

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
            Map<String, Object> objRefMap) throws Exception {
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
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("commentText").setText(this.getText());

        return retVal;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) {
        return null;
    }
}