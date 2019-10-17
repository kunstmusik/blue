/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (kunstmusik@hotmail.com)
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
import blue.noteProcessor.NoteProcessorChain;
import blue.score.ScoreObject;
import electric.xml.Element;
import java.util.Map;

/**
 * Plugin interface for SoundObjects.
 * 
 * SoundObjects are note generator blocks. As a theoretical entity, they are a
 * perceived sonic entity. Just a phrase is a perceived entity made up of
 * motives, another entity in itself, SoundObjects can contain other
 * SoundObjects.
 * 
 * When compiled out CSD, the following methods are called in the following
 * order:
 * 
 * <nl>
 * <li>generateGlobals</li>
 * <li>generateFTables</li>
 * <li>generateInstruments</li>
 * <li>generateNotes</li>
 * </nl>
 * 
 * SoundObjects are required to implement a static loadFromXML method that will
 * return an instance of the SoundObject read from XML.
 * 
 * 
 */
public interface SoundObject extends ScoreObject {

    /**
     * SoundObject does not support applying time behaviors and is assumed to
     * generate score for duration of subjectiveDuration
     */
    public final static int TIME_BEHAVIOR_NOT_SUPPORTED = -1;

    public final static int TIME_BEHAVIOR_SCALE = 0;

    public final static int TIME_BEHAVIOR_REPEAT = 1;

    public final static int TIME_BEHAVIOR_NONE = 2;

    /**
     * Returns a blue.soundObject.editor.SoundObjectEditor, which is the GUI
     * editor for the SoundObject.
     */
//    public SoundObjectEditor getEditor();

    /**
     * 
     * @param globalOrcSco
     */

//    public void generateGlobals(GlobalOrcSco globalOrcSco);

    /**
     * Called during compile-time, this method is passed a blue.Tables object so
     * that any ftables this SoundObject might have can be added to the
     * generated CSD.
     * 
     * @param tables
     */
//    public void generateFTables(Tables tables);

    /**
     * Called during compile-time, this method is passed a blue.Orchestra object
     * so that any instruments this SoundObject might have can be added to the
     * generated CSD.
     * 
     * Called after generateFTables() but before generateNotes().
     */
//    public void generateInstruments(Arrangement arr);

    /**
     * Called during compile-time, returns the generated notes from the
     * SoundObject. SoundObjects which want to support partial object rendering
     * can use the renderStart and renderEnd times when generating notes.
     * Otherwise, SoundObjects can ignore using those values and generated notes
     * which do not fall within the global renderStart and renderEnd times will
     * be removed before rendering.
     * 
     * blue.utility.ScoreUtilities has useful methods for working with
     * Text-to-Notelist and NoteList utilities.
     * 
     * @param renderStart
     *            Time scaled to this soundObject's duration of where to start
     *            render from. If render start is before this object's start
     *            time, renderStart will be passed in as 0.0f.
     * 
     * @param renderEnd
     *            Time scaled to this soundObject's duration where to end
     *            render. If the render end is after this soundObjects end time,
     *            render end will be passed in as negative value.
     */
//    public NoteList generateNotes(double renderStart, double renderEnd)
//            throws SoundObjectException;

    public NoteList generateForCSD(CompileData compileData, double startTime, 
            double endTime) throws SoundObjectException;
    

    /**
     * Gets the objective duration of the SoundObject.
     * 
     * The objective duration of the soundObject is the amount of time a
     * SoundObject's content lasts. For example, the following score:
     * 
     * i1 0 2 3 4 5
     * 
     * has objective duration of 2 beats in Csound. You can set the subjective
     * duration such that the SoundObject will last 10 seconds, but internally,
     * the note content is only 2 beats.
     * 
     * Reporting the objective duration is useful when viewed as a ratio with
     * subjective duration. i.e. "This SoundObject is twice as long as the
     * original".
     * 
     * Some SoundObjects may not have an objective duration as their note
     * generation is dependent on the subjective duration of the soundObject.
     * For these SoundObjects you can return null here.
     */
    public double getObjectiveDuration();

    /**
     * Returns a blue.soundObject.renderer.BarRenderer which renders the
     * SoundObject on the main timeline.
     */
//    public BarRenderer getRenderer();

    /**
     * Gets the NoteProcessorChain for this SoundObject. Return null if
     * SoundObject does not support noteProcessors.
     */
    public NoteProcessorChain getNoteProcessorChain();

    public int getTimeBehavior();

    public void setTimeBehavior(int timeBehavior);

    /**
     * Gets the point at which, in the score, a repeat of this score should
     * occur if the time behavior for this sound object is repeatable.
     */
    public double getRepeatPoint();

    /**
     * See getRepeatPoint
     */
    public void setRepeatPoint(double repeatPoint);

    /**
     * Returns and XML Element representation of this SoundObject
     * 
     * @param objRefMap
     */
    public Element saveAsXML(Map<Object, String> objRefMap);

    /**
     * @param chain
     */
    public void setNoteProcessorChain(NoteProcessorChain chain);

    @Override
    public SoundObject deepCopy();
    
}