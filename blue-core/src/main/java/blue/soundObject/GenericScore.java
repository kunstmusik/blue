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
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.score.ScoreObjectEvent;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.util.Map;

@SoundObjectPlugin(displayName = "GenericScore", live = true, position = 40)
public class GenericScore extends AbstractSoundObject implements
        GenericViewable {

    private NoteProcessorChain npc = new NoteProcessorChain();

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0f;

    private String score;

    public GenericScore() {
        setName("GenericScore");
        score = "i1 0 2 3 4 5";
        timeBehavior = TimeBehavior.SCALE;
    }

    public GenericScore(GenericScore score) {
        super(score);
        timeBehavior = score.timeBehavior;
        this.score = score.score;
        npc = new NoteProcessorChain(score.npc);
        repeatPoint = score.repeatPoint;
    }

    // public accessor methods
    public String getText() {
        return score;
    }

    public void setText(String text) {
        this.score = text;
    }

    @Override
    public TimeDuration getObjectiveDuration(TimeContext context) {
        NoteList notes = null;

        try {
            notes = ScoreUtilities.getNotes(score);
        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
        if (notes == null) {
            return TimeDuration.beats(0.0);
        } else {
            return TimeDuration.beats(ScoreUtilities.getTotalDuration(notes));
        }
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public final NoteList generateNotes(TimeContext context, double renderStart, double renderEnd) throws SoundObjectException {
        NoteList nl;
        try {
            nl = ScoreUtilities.getNotes(score);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }
        try {
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        double duration = this.getSubjectiveDuration().toBeats(context);
        double startTime = this.getStartTime().toBeats(context);
        
        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), duration, this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);

        return nl;
    }

    public static GenericScore transformSoundObject(SoundObject sObj)
            throws SoundObjectException {
        GenericScore buffer = new GenericScore();
        buffer.setStartTime(sObj.getStartTime());
        buffer.setSubjectiveDuration(sObj.getSubjectiveDuration());
        buffer.setName("GEN: " + sObj.getName());

        sObj.setStartTime(TimePosition.beats(0.0));
        // This static utility should be called from UI layer with TimeContext set
        TimeContext context = TimeContextManager.getContext();
        buffer.setText(sObj.generateForCSD(context, null, 0.0f, -1.0f).toString());
        return buffer;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }
    @Override
    public void setNoteProcessorChain(NoteProcessorChain noteProcessorChain) {
        this.npc = noteProcessorChain;
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
        GenericScore genScore = new GenericScore();

        SoundObjectUtilities.initBasicFromXML(data, genScore);

        String tempScore = data.getElement("score").getTextString();

        if (tempScore == null) {
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
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("score").setText(this.getText());

        return retVal;
    }

    @Override
    public NoteList generateForCSD(TimeContext context, CompileData compileData, double startTime,
            double endTime) throws SoundObjectException {

        NoteList nl = generateNotes(context, startTime, endTime);
        return nl;

    }

    @Override
    public GenericScore deepCopy() {
        return new GenericScore(this);
    }

}
