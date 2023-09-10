/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

import blue.CompileData;
import blue.score.ScoreObjectEvent;
import blue.noteProcessor.NoteProcessorChain;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.jmask.Field;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.Map;
import java.util.Random;
import org.apache.commons.lang3.builder.ToStringBuilder;

@SoundObjectPlugin(displayName = "JMask", live = true, position = 50)
public class JMask extends AbstractSoundObject {

    private NoteProcessorChain npc = new NoteProcessorChain();

    private Field field = new Field();

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0f;

    boolean seedUsed = false;

    long seed = 0L;

    public JMask() {
        setName("JMask");
        timeBehavior = TimeBehavior.SCALE;
    }

    public JMask(JMask jmask) {
        super(jmask);
        npc = new NoteProcessorChain(jmask.npc);
        field = new Field(jmask.field);
        timeBehavior = jmask.timeBehavior;
        repeatPoint = jmask.repeatPoint;
        seedUsed = jmask.seedUsed;
        seed = jmask.seed;
    }

    public NoteList generateNotes(double renderStart, double renderEnd) throws SoundObjectException {

        Field temp = new Field(field);

        Random rnd = seedUsed ? new Random(seed) : new Random();

        NoteList nl;

        try {
            nl = temp.generateNotes(this.getSubjectiveDuration(), rnd);
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (Exception e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());

        ScoreUtilities.setScoreStart(nl, startTime);

        return nl;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public double getObjectiveDuration() {
        return subjectiveDuration;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }
    @Override
    public double getRepeatPoint() {
        return repeatPoint;
    }

    @Override
    public TimeBehavior getTimeBehavior() {
        return this.timeBehavior;
    }

    @Override
    public void setTimeBehavior(TimeBehavior timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        JMask jmask = new JMask();

        SoundObjectUtilities.initBasicFromXML(data, jmask);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            switch(nodeName) {
                case "field":
                    jmask.setField(Field.loadFromXML(node));
                    break;
                case "seed":
                    jmask.setSeed(Long.parseLong(node.getTextString()));
                    break;
                case "seedUsed":
                    jmask.setSeedUsed(Boolean.parseBoolean(node.getTextString()));
                    break;
            }
        }

        return jmask;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("seedUsed").setText(Boolean.toString(seedUsed));
        retVal.addElement("seed").setText(Long.toString(seed));
        retVal.addElement(field.saveAsXML());

        return retVal;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    @Override
    public void setRepeatPoint(double repeatPoint) {
        this.repeatPoint = repeatPoint;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.REPEAT_POINT);

        fireScoreObjectEvent(event);
    }

    public Field getField() {
        return field;
    }

    public void setField(Field field) {
        this.field = field;
    }

    public boolean isSeedUsed() {
        return seedUsed;
    }

    public void setSeedUsed(boolean seedUsed) {
        this.seedUsed = seedUsed;
    }

    public long getSeed() {
        return seed;
    }

    public void setSeed(long seed) {
        this.seed = seed;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime,
            double endTime) throws SoundObjectException {

        NoteList nl = generateNotes(startTime, endTime);
        return nl;

    }

    @Override
    public JMask deepCopy() {
        return new JMask(this);
    }
}
