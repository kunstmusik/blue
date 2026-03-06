/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject;

import blue.CompileData;
import blue.SoundLayer;
import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class PolyObjectTest {

    @Test
    void testIsScoreGenerationEmpty() {
        PolyObject pObj = new PolyObject();
        PolyObject pObj2 = new PolyObject();

        SoundLayer sLayer = new SoundLayer();
        SoundLayer sLayer2 = new SoundLayer();
        sLayer.add(pObj2);
        pObj2.add(sLayer2);

        Comment comment = new Comment();
        GenericScore genScore = new GenericScore();

        assertTrue(pObj.isScoreGenerationEmpty());

        pObj.add(sLayer);

        assertTrue(pObj.isScoreGenerationEmpty());

        sLayer.add(comment);
        assertTrue(pObj.isScoreGenerationEmpty());
        assertTrue(pObj2.isScoreGenerationEmpty());

        sLayer.remove(comment);
        sLayer2.add(comment);
        assertTrue(pObj.isScoreGenerationEmpty());
        assertTrue(pObj2.isScoreGenerationEmpty());

        sLayer.add(genScore);

        assertFalse(pObj.isScoreGenerationEmpty());
        assertTrue(pObj2.isScoreGenerationEmpty());

        sLayer.remove(genScore);
        sLayer2.add(genScore);
        assertFalse(pObj.isScoreGenerationEmpty());
        assertFalse(pObj2.isScoreGenerationEmpty());
    }
    
    @Test
    void testResizeLeftPreservesTimeAndDurationTypes() {
        PolyObject pObj = new PolyObject();
        TimeContext context = new TimeContext();
        blue.ProjectProperties polyProps = new blue.ProjectProperties();
        polyProps.setSampleRate("48000");
        context.setProjectProperties(polyProps);
        pObj.setStartTime(TimePosition.frames(48000));
        pObj.setSubjectiveDuration(TimeDuration.frames(96000));
        
        pObj.resizeLeft(context, 0.5);
        
        assertTrue(pObj.getStartTime() instanceof TimePosition.FrameValue);
        assertTrue(pObj.getSubjectiveDuration() instanceof TimeDuration.DurationFrames);
        assertEquals(24000, ((TimePosition.FrameValue) pObj.getStartTime()).getFrameNumber());
        assertEquals(120000, ((TimeDuration.DurationFrames) pObj.getSubjectiveDuration()).getFrameCount());
    }
    
    @Test
    void testResizeRightPreservesDurationType() {
        PolyObject pObj = new PolyObject();
        TimeContext context = new TimeContext();
        pObj.setStartTime(TimePosition.time(0, 0, 1, 0));
        pObj.setSubjectiveDuration(TimeDuration.time(0, 0, 2, 0));
        
        pObj.resizeRight(context, 4.0);
        
        assertTrue(pObj.getSubjectiveDuration() instanceof TimeDuration.DurationTime);
        TimeDuration.DurationTime duration = (TimeDuration.DurationTime) pObj.getSubjectiveDuration();
        assertEquals(0, duration.getHours());
        assertEquals(0, duration.getMinutes());
        assertEquals(3, duration.getSeconds());
        assertEquals(0, duration.getMilliseconds());
    }

    @Test
    void testPartialRenderPianoRollRebasesToZeroForBeatStart() throws Exception {
        TimeContext context = new TimeContext();
        PolyObject pObj = new PolyObject();
        pObj.setTimeBehavior(TimeBehavior.NONE);
        pObj.setStartTime(TimePosition.beats(0.0));
        pObj.setSubjectiveDuration(TimeDuration.beats(16.0));

        SoundLayer layer = new SoundLayer();
        PianoRoll pianoRoll = new PianoRoll();
        pianoRoll.setStartTime(TimePosition.beats(4.0));
        pianoRoll.setSubjectiveDuration(TimeDuration.beats(8.0));

        var note = new blue.soundObject.pianoRoll.PianoNote();
        note.setStart(0.0);
        note.setDuration(1.0);
        pianoRoll.getNotes().add(note);

        layer.add(pianoRoll);
        pObj.add(layer);

        NoteList notes = pObj.generateForCSD(context, CompileData.createEmptyCompileData(), 4.0, -1.0);

        assertEquals(2, notes.size());
        assertEquals(0.0, notes.get(0).getStartTime(), 0.0001);
        assertEquals(4.0, notes.get(1).getStartTime(), 0.0001);
    }

    @Test
    void testPartialRenderPatternObjectRebasesToZeroForBeatStart() throws Exception {
        TimeContext context = new TimeContext();
        PolyObject pObj = new PolyObject();
        pObj.setTimeBehavior(TimeBehavior.NONE);
        pObj.setStartTime(TimePosition.beats(0.0));
        pObj.setSubjectiveDuration(TimeDuration.beats(16.0));

        SoundLayer layer = new SoundLayer();
        PatternObject patternObject = new PatternObject();
        patternObject.setStartTime(TimePosition.beats(4.0));
        patternObject.setSubjectiveDuration(TimeDuration.beats(8.0));

        patternObject.setTime(4, 1);
        patternObject.addPattern(0);
        var pattern = patternObject.getPattern(0);
        pattern.values[0] = true;
        pattern.setPatternScore("i1 0 1 8.00");

        layer.add(patternObject);
        pObj.add(layer);

        NoteList notes = pObj.generateForCSD(context, CompileData.createEmptyCompileData(), 4.0, -1.0);

        assertEquals(2, notes.size());
        assertEquals(0.0, notes.get(0).getStartTime(), 0.0001);
        assertEquals(4.0, notes.get(1).getStartTime(), 0.0001);
    }

//    public void testGetAdjustedRenderStart() {
//        PolyObject pObj = new PolyObject();
//        SoundLayer sLayer = new SoundLayer();
//        GenericScore genScore = new GenericScore();
//
//        genScore.setStartTime(0.0f);
//        genScore.setSubjectiveDuration(2.0f);
//
//        pObj.add(sLayer);
//        pObj.setRoot(true);
//        pObj.setStartTime(1.0f);
//        pObj.setSubjectiveDuration(2.0f);
//
//        sLayer.add(genScore);
//
//        assertEquals(1.0f, pObj.getAdjustedRenderStart(1.0f), .0001f);
//        assertEquals(2.0f, pObj.getAdjustedRenderStart(2.0f), .0001f);
//
//        pObj.setRoot(false);
//
//        assertEquals(0.0f, pObj.getAdjustedRenderStart(1.0f), .0001f);
//        assertEquals(1.0f, pObj.getAdjustedRenderStart(2.0f), .0001f);
//
//        genScore.setSubjectiveDuration(4.0f);
//
//        assertEquals(0.0f, pObj.getAdjustedRenderStart(1.0f), .0001f);
//        assertEquals(0.5f, pObj.getAdjustedRenderStart(2.0f), .0001f);
//    }
//
//    public void testGetAdjustedRenderEnd() {
//        PolyObject pObj = new PolyObject();
//        SoundLayer sLayer = new SoundLayer();
//        GenericScore genScore = new GenericScore();
//
//        genScore.setStartTime(0.0f);
//        genScore.setSubjectiveDuration(2.0f);
//
//        pObj.add(sLayer);
//        pObj.setRoot(true);
//        pObj.setStartTime(1.0f);
//        pObj.setSubjectiveDuration(2.0f);
//
//        sLayer.add(genScore);
//
//        assertEquals(1.0f, pObj.getAdjustedRenderEnd(1.0f), .0001f);
//        assertEquals(2.0f, pObj.getAdjustedRenderEnd(2.0f), .0001f);
//        assertEquals(-1.0f, pObj.getAdjustedRenderEnd(-1.0f), .0001f);
//
//        pObj.setRoot(false);
//
//        assertEquals(0.0f, pObj.getAdjustedRenderEnd(1.0f), .0001f);
//        assertEquals(1.0f, pObj.getAdjustedRenderEnd(2.0f), .0001f);
//
//        genScore.setSubjectiveDuration(4.0f);
//
//        assertEquals(0.0f, pObj.getAdjustedRenderEnd(1.0f), .0001f);
//        assertEquals(0.5f, pObj.getAdjustedRenderEnd(2.0f), .0001f);
//        assertEquals(-1.0f, pObj.getAdjustedRenderEnd(3.0f), .0001f);
//
//
//    }
}
