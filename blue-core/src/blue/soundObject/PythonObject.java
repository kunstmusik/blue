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
import blue.scripting.PythonProxy;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.Serializable;
import org.python.core.PyException;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */
public class PythonObject extends AbstractSoundObject implements Serializable,
        Cloneable, OnLoadProcessable {

//    private static BarRenderer renderer = new LetterRenderer("P");

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private String pythonCode;

    private boolean onLoadProcessable = false;

    public PythonObject() {
        setName("PythonObject");

        pythonCode = BlueSystem.getString("pythonObject.defaultCode");
        pythonCode += "\n\nscore = \"i1 0 2 3 4 5\"";

        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public void setText(String text) {
        this.pythonCode = text;
    }

    public String getText() {
        return this.pythonCode;
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

//    public SoundObjectEditor getEditor() {
//        return new PythonEditor();
//    }

    /*
     * public String generateScore() { String tempScore =
     * pProxy.processPythonCode(pythonCode, subjectiveDuration); Note[] notes =
     * ScoreUtilities.getNotes(tempScore.toString()); float totalDur =
     * ScoreUtilities.getTotalDuration(notes); ScoreUtilities.scaleScore(notes,
     * (subjectiveDuration/totalDur)); ScoreUtilities.setScoreStart(notes,
     * startTime); return ScoreUtilities.notesToString(notes); }
     */
    public final NoteList generateNotes(float renderStart, float renderEnd) throws
            SoundObjectException {
        /*
         * System.out.println( "[pythonObject] attempting to generate score for
         * object " + this.name + " at time " + this.startTime);
         */

        String tempScore = null;

        try {
            tempScore = PythonProxy.processPythonScore(pythonCode,
                    subjectiveDuration);
        } catch (PyException pyEx) {
            String msg = "Jython Error:\n" + pyEx.toString();
            throw new SoundObjectException(this, msg);
        }

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

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this.
                getSubjectiveDuration(), this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);
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

    public int getTimeBehavior() {
        return this.timeBehavior;
    }

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
        PythonObject pObj = new PythonObject();

        SoundObjectUtilities.initBasicFromXML(data, pObj);

        pObj.setText(data.getTextString("pythonCode"));

        String olpString = data.getAttributeValue("onLoadProcessable");

        if (olpString != null) {
            pObj.setOnLoadProcessable(
                    Boolean.valueOf(olpString).booleanValue());
        }


        return pObj;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("pythonCode").setText(this.getText());
        retVal.setAttribute("onLoadProcessable",
                Boolean.toString(onLoadProcessable));

        return retVal;
    }

    public void setOnLoadProcessable(boolean onLoadProcessable) {
        this.onLoadProcessable = onLoadProcessable;
    }

    public boolean isOnLoadProcessable() {
        return this.onLoadProcessable;
    }

    public void processOnLoad() throws SoundObjectException {
        if (onLoadProcessable) {
            this.generateNotes(0.0f, -1.0f);
        }
    }
}
