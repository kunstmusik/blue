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

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
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

@SoundObjectPlugin(displayName = "JavaScriptObject", live=true, position = 120)
public class JavaScriptObject extends AbstractSoundObject {

    private String javaScriptCode;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    double repeatPoint = -1.0f;

    public JavaScriptObject() {
        setName("javaScriptObject");
        javaScriptCode = BlueSystem.getString("rhinoObject.defaultCode");
        javaScriptCode += "\n\nscore = \"i1 0 2 3 4 5\";";
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public JavaScriptObject(JavaScriptObject ro) {
        super(ro);
        npc = new NoteProcessorChain(ro.npc);
        timeBehavior = ro.timeBehavior;
        repeatPoint = ro.repeatPoint;
        javaScriptCode = ro.javaScriptCode;
    }

    public void setText(String text) {
        this.javaScriptCode = text;
    }

    public String getText() {
        return this.javaScriptCode;
    }

    @Override
    public double getObjectiveDuration() {
        return subjectiveDuration;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    public NoteList generateNotes(double renderStart, double renderEnd) throws SoundObjectException {
        // System.out.println("[JavaScriptObject] attempting to generate score for
        // object " + this.name + " at time " + this.startTime);
        String soundObjectId = "[ " + this.name + " : " + this.startTime
                + " ] ";
        String tempScore = blue.scripting.JavaScriptProxy.processJavascriptScore(
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

        // double totalDur = ScoreUtilities.getTotalDuration(notes);
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
    @Override
    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#setTimeBehavior(int)
     */
    @Override
    public void setTimeBehavior(int timeBehavior) {
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
        JavaScriptObject sObj = new JavaScriptObject();

        SoundObjectUtilities.initBasicFromXML(data, sObj);

        sObj.setText(data.getTextString("javaScriptCode"));

        return sObj;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("javaScriptCode").setText(this.getText());

        return retVal;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime, 
            double endTime) throws SoundObjectException {
        
        return generateNotes(startTime, endTime);
        
    }

    @Override
    public SoundObject deepCopy() {
        return new JavaScriptObject(this);
    }
}
