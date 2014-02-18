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

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.score.ScoreObject;
import blue.soundObject.jmask.Field;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.Map;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class JMask extends AbstractSoundObject {

    private NoteProcessorChain npc = new NoteProcessorChain();

    private Field field = new Field();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    public JMask() {
        setName("JMask");

        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {

        Field temp = (Field) ObjectUtilities.clone(field);
        
        NoteList nl = temp.generateNotes(this.getSubjectiveDuration());

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


    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public float getRepeatPoint() {
        return repeatPoint;
    }

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

            if (nodeName.equals("field")) {
                jmask.setField(Field.loadFromXML(node));
            }
        }

        return jmask;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement(field.saveAsXML());

        return retVal;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    public void setRepeatPoint(float repeatPoint) {
        this.repeatPoint = repeatPoint;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.REPEAT_POINT);

        fireSoundObjectEvent(event);
    }

    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    public Field getField() {
        return field;
    }

    public void setField(Field field) {
        this.field = field;
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
