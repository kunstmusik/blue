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

import blue.BlueSystem;
import blue.CompileData;
import blue.clojure.BlueClojureEngine;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.AbstractSoundObject;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.OnLoadProcessable;
import blue.soundObject.SoundObject;
import blue.score.ScoreObjectEvent;
import blue.soundObject.SoundObjectException;
import blue.soundObject.SoundObjectUtilities;
import blue.soundObject.TimeBehavior;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.File;
import java.util.HashMap;
import java.util.Map;
import javax.script.ScriptException;

/**
 *
 * @author stevenyi
 */
@SoundObjectPlugin(displayName = "ClojureObject", position = 25)
public class ClojureObject extends AbstractSoundObject implements
        OnLoadProcessable {

    private NoteProcessorChain npc = new NoteProcessorChain();

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0;

    private String clojureCode;

    private boolean onLoadProcessable = false;

    public ClojureObject() {
        setName("(clojure-object)");

        clojureCode = ";use symbol blueDuration for duration from blue\n";
        clojureCode += "(def score \"i1 0 2 3 4 5\")";

        timeBehavior = TimeBehavior.SCALE;
    }

    public ClojureObject(ClojureObject co) {
        super(co);
        npc = new NoteProcessorChain(co.npc);
        timeBehavior = co.timeBehavior;
        repeatPoint = co.repeatPoint;
        clojureCode = co.clojureCode;
        onLoadProcessable = co.onLoadProcessable;
    }

    public String getClojureCode() {
        return clojureCode;
    }

    public void setClojureCode(String code) {
        this.clojureCode = code;
    }

    private Throwable getRootCauseException(ScriptException se) {
        ScriptException root = se;
        Throwable e = se;
        while (e != null) {
            e = e.getCause();
            if (e instanceof ScriptException) {
                root = (ScriptException) e;
            }
        }
        return root.getCause();
    }

    protected final NoteList generateNotes(double renderStart, double renderEnd) throws
            SoundObjectException {

        String tempScore = null;

        File currentDirFile = BlueSystem.getCurrentProjectDirectory();

        HashMap<String, Object> initObjects = new HashMap<>();
        initObjects.put("score", "");
        initObjects.put("blueDuration", getSubjectiveDuration());
        initObjects.put("blueProjectDir", currentDirFile);

        try {
            tempScore = BlueClojureEngine.getInstance().
                    processScript(clojureCode, initObjects, "score");
        } catch (ScriptException scriptEx) {

            String msg = "Clojure Error:\n"
                    + getRootCauseException(scriptEx).toString();
            throw new SoundObjectException(this, msg);
        }

        NoteList nl;

        try {
            nl = ScoreUtilities.getNotes(tempScore);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }

        try {
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this.
                getSubjectiveDuration(), this.getRepeatPoint());
        ScoreUtilities.setScoreStart(nl, startTime);
        return nl;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime, double endTime) throws SoundObjectException {
        return generateNotes(startTime, endTime);
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
    public TimeBehavior getTimeBehavior() {
        return timeBehavior;
    }

    @Override
    public void setTimeBehavior(TimeBehavior timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public double getRepeatPoint() {
        return repeatPoint;
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
        ClojureObject clojureObj = new ClojureObject();

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

    @Override
    public ClojureObject deepCopy() {
        return new ClojureObject(this);
    }

}
