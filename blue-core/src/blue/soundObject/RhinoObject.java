/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.soundObject;

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
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

public class RhinoObject extends AbstractSoundObject implements Serializable,
        Cloneable, GenericEditable {

    private String javaScriptCode;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    public RhinoObject() {
        setName("rhinoObject");

        javaScriptCode = BlueSystem.getString("rhinoObject.defaultCode");
        javaScriptCode += "\n\nscore = \"i1 0 2 3 4 5\";";

        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public void setText(String text) {
        this.javaScriptCode = text;
    }

    public String getText() {
        return this.javaScriptCode;
    }

    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
        // System.out.println("[RhinoObject] attempting to generate score for
        // object " + this.name + " at time " + this.startTime);
        String soundObjectId = "[ " + this.name + " : " + this.startTime
                + " ] ";
        String tempScore = blue.scripting.RhinoProxy.processJavascriptScore(
                javaScriptCode, subjectiveDuration, soundObjectId);

        NoteList nl;

        try {
            nl = ScoreUtilities.getNotes(tempScore);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        // float totalDur = ScoreUtilities.getTotalDuration(notes);
        // ScoreUtilities.scaleScore(notes, (subjectiveDuration/totalDur));

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);
        return nl;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#getTimeBehavior()
     */
    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#setTimeBehavior(int)
     */
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
        RhinoObject sObj = new RhinoObject();

        SoundObjectUtilities.initBasicFromXML(data, sObj);

        sObj.setText(data.getTextString("javaScriptCode"));

        return sObj;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("javaScriptCode").setText(this.getText());

        return retVal;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) {
        try {
            return generateNotes(startTime, endTime);
        } catch (SoundObjectException ex) {
            throw new RuntimeException(ex);
        }
    }
}
