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
@SoundObjectPlugin(displayName = "JavaScriptObject", live = true, position = 120)
public class JavaScriptObject extends AbstractSoundObject
        implements OnLoadProcessable {

    private String javaScriptCode;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0f;

    private boolean onLoadProcessable = false;

    public JavaScriptObject() {
        setName("javaScriptObject");
        javaScriptCode = BlueSystem.getString("rhinoObject.defaultCode");
        javaScriptCode += "\n\nscore = \"i1 0 2 3 4 5\";";
        timeBehavior = TimeBehavior.SCALE;
    }

    public JavaScriptObject(JavaScriptObject ro) {
        super(ro);
        npc = new NoteProcessorChain(ro.npc);
        timeBehavior = ro.timeBehavior;
        repeatPoint = ro.repeatPoint;
        javaScriptCode = ro.javaScriptCode;
        onLoadProcessable = ro.onLoadProcessable;
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
        try {
            String tempScore = blue.scripting.JavaScriptProxy.processJavascriptScore(
                    javaScriptCode, subjectiveDuration, soundObjectId);

            NoteList nl = ScoreUtilities.getNotes(tempScore);
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
            ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                    .getSubjectiveDuration(), this.getRepeatPoint());
            ScoreUtilities.setScoreStart(nl, startTime);
            return nl;
        } catch (Exception e) {
            throw new SoundObjectException(this, e);
        }

        // double totalDur = ScoreUtilities.getTotalDuration(notes);
        // ScoreUtilities.scaleScore(notes, (subjectiveDuration/totalDur));
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
        JavaScriptObject sObj = new JavaScriptObject();

        SoundObjectUtilities.initBasicFromXML(data, sObj);

        sObj.setText(data.getTextString("javaScriptCode"));

        String olpString = data.getAttributeValue("onLoadProcessable");

        if (olpString != null) {
            sObj.setOnLoadProcessable(
                    Boolean.valueOf(olpString).booleanValue());
        }

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
        retVal.setAttribute("onLoadProcessable",
                Boolean.toString(onLoadProcessable));

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

    @Override
    public void setOnLoadProcessable(boolean onLoadProcessable) {
        this.onLoadProcessable = onLoadProcessable;
    }

    @Override
    public boolean isOnLoadProcessable() {
        return this.onLoadProcessable;
    }

    @Override
    public void processOnLoad() throws SoundObjectException {
        if (onLoadProcessable) {
            this.generateNotes(0.0f, -1.0f);
        }
    }
}
