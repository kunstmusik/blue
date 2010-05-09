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

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

import java.io.Serializable;

import blue.Arrangement;
import blue.GlobalOrcSco;
import blue.SoundObjectLibrary;
import blue.Tables;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.soundObject.GenericEditable;
import blue.utility.ScoreUtilities;
import electric.xml.Element;

public class GenericScore extends AbstractSoundObject implements Serializable,
        Cloneable, GenericEditable, GenericViewable {

//    private static BarRenderer renderer = new GenericRenderer();

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private String score;

    public GenericScore() {
        setName("GenericScore");

        score = "i1 0 2 3 4 5";

        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    // public accessor methods

    public String getText() {
        return score;
    }

    public void setText(String text) {
        this.score = text;
    }

    public float getObjectiveDuration() {
        NoteList notes = null;

        try {
            notes = ScoreUtilities.getNotes(score);
        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
        if (notes == null) {
            return 0;
        } else {
            return ScoreUtilities.getTotalDuration(notes);
        }
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
    }

    public void generateFTables(Tables tables) {
    }

    public final NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
        NoteList nl;
        try {
            nl = ScoreUtilities.getNotes(score);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }
        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());

        ScoreUtilities.setScoreStart(nl, startTime);

        return nl;
    }

    public void generateInstruments(Arrangement arrangement) {
    }

//    public SoundObjectEditor getEditor() {
//        return new GenericEditor();
//    }

    public static GenericScore transformSoundObject(SoundObject sObj)
            throws SoundObjectException {
        GenericScore buffer = new GenericScore();
        buffer.setStartTime(sObj.getStartTime());
        buffer.setSubjectiveDuration(sObj.getSubjectiveDuration());
        buffer.setName("GEN: " + sObj.getName());

        sObj.setStartTime(0.0f);
        buffer.setText(sObj.generateNotes(0.0f, -1.0f).toString());
        return buffer;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public void setNoteProcessorChain(NoteProcessorChain noteProcessorChain) {
        this.npc = noteProcessorChain;
    }

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
        GenericScore genScore = new GenericScore();

        SoundObjectUtilities.initBasicFromXML(data, genScore);

        String tempScore = data.getElement("score").getTextString();
        
        if(tempScore == null) {
            genScore.setText("");
        } else {
            genScore.setText(tempScore);
        }

        return genScore;

    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("score").setText(this.getText());

        return retVal;
    }

} 