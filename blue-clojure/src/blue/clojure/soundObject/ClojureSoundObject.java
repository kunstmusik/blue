/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.clojure.soundObject;

import blue.CompileData;
import blue.clojure.BlueClojureEngine;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.soundObject.AbstractSoundObject;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.OnLoadProcessable;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectEvent;
import blue.soundObject.SoundObjectException;
import blue.soundObject.SoundObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.Serializable;
import java.util.Map;
import javax.script.ScriptException;

/**
 *
 * @author stevenyi
 */
public class ClojureSoundObject extends AbstractSoundObject implements Serializable,
        Cloneable, OnLoadProcessable {
    
    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private String clojureCode;

    private boolean onLoadProcessable = false;
    
    public ClojureSoundObject() {
        setName("(clojure-sound-object)");

        clojureCode = "(def score \"i1 0 2 3 4 5\")";

        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

    public String getClojureCode() {
        return clojureCode;
    }

    public void setClojureCode(String code) {
        this.clojureCode = code;
    }
    
    protected final NoteList generateNotes(float renderStart, float renderEnd) throws
            SoundObjectException {
        
        String tempScore = null;

        try {
            tempScore = BlueClojureEngine.getInstance().
                    processScript(clojureCode, null, "score");
        } catch (ScriptException scriptEx) {
            String msg = "Clojure Error:\n" + scriptEx.toString();
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
    
    
    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) throws SoundObjectException {
        return generateNotes(startTime, endTime);
    }

    @Override
    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public int getTimeBehavior() {
        return timeBehavior;
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public float getRepeatPoint() {
        return repeatPoint;
    }

    @Override
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
            Map<String, Object> objRefMap) throws Exception {
        ClojureSoundObject clojureObj = new ClojureSoundObject();

        SoundObjectUtilities.initBasicFromXML(data, clojureObj);

        clojureObj.setClojureCode(data.getTextString("clojureCode"));

        String olpString = data.getAttributeValue("onLoadProcessable");

        if (olpString != null) {
            clojureObj.setOnLoadProcessable(
                    Boolean.valueOf(olpString).booleanValue());
        }


        return clojureObj;

    }
    
    @Override
        public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("clojureCode").setText(this.getClojureCode());
        retVal.setAttribute("onLoadProcessable",
                Boolean.toString(onLoadProcessable));

        return retVal;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    @Override
    public void setOnLoadProcessable(boolean onLoadProcessable) {
        this.onLoadProcessable = onLoadProcessable;
    }

    @Override
    public boolean isOnLoadProcessable() {
        return onLoadProcessable;
    }

    @Override
    public void processOnLoad() throws SoundObjectException {
        if (onLoadProcessable) {
            this.generateNotes(0.0f, -1.0f);
        }
    }
    
}
