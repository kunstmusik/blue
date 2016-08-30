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
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.jmask.Field;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.Map;
import java.util.Random;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

@SoundObjectPlugin(displayName = "JMask", live = true, position = 50)
public class JMask extends AbstractSoundObject {

    private NoteProcessorChain npc = new NoteProcessorChain();

    private Field field = new Field();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    boolean seedUsed = false;

    long seed = 0L;

    public JMask() {
        setName("JMask");
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {

        Field temp = (Field) ObjectUtilities.clone(field);

        Random rnd = seedUsed ? new Random(seed) : new Random();

        NoteList nl = temp.generateNotes(this.getSubjectiveDuration(), rnd);

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

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }
    @Override
    public float getRepeatPoint() {
        return repeatPoint;
    }

    @Override
    public int getTimeBehavior() {
        return timeBehavior;
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
    public void setRepeatPoint(float repeatPoint) {
        this.repeatPoint = repeatPoint;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.REPEAT_POINT);

        fireScoreObjectEvent(event);
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
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
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public SoundObject clone() {
        return (SoundObject) ObjectUtilities.clone(this);
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime,
            float endTime) throws SoundObjectException {

        NoteList nl = generateNotes(startTime, endTime);
        return nl;

    }
}
