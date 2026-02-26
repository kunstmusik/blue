/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.score.layers.audio.core;

import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;

/**
 *
 * @author stevenyi
 */
class AudioClipTest {

    AudioClip instance = null;
    TimeContext timeContext;

    public AudioClipTest() {
    }

    @BeforeEach
    void setUp() {
        instance = new AudioClip();
        timeContext = new TimeContext();
        instance.audioDuration = 10.0f;
        instance.setSubjectiveDuration(TimeDuration.beats(5.0));
        instance.setStartTime(TimePosition.beats(10.0));
        instance.setFileStartTime(5.0f);
    }

    @AfterEach
    void tearDown() {
        instance = null;
    }

    /**
     * Test of resizeLeft method, of class AudioClip.
     */
    @Test
    void testResizeLeft() {
        float newStartTime = 5.0f;
        instance.resizeLeft(timeContext, newStartTime);

        assertEquals(5.0, instance.getStartTime().toBeats(timeContext), 0.001);
        assertEquals(0.0, instance.getFileStartTime(), 0.001);
        assertEquals(10.0, instance.getSubjectiveDuration().toBeats(timeContext), 0.001);

        instance.resizeLeft(timeContext, 4.0f);

        assertEquals(4.0, instance.getStartTime().toBeats(timeContext), 0.001);
        assertEquals(9.0, instance.getFileStartTime(), 0.001);
        assertEquals(11.0, instance.getSubjectiveDuration().toBeats(timeContext), 0.001);
    }

    /**
     * Test of resizeRight method, of class AudioClip.
     */
    @Test
    void testResizeRight() {
        float newEndTime = 20.0F;
        instance.setFileStartTime(0.0f);
        instance.resizeRight(timeContext, newEndTime);

        assertEquals(10.0, instance.getStartTime().toBeats(timeContext), 0.001);
        assertEquals(0.0, instance.getFileStartTime(), 0.001);
        assertEquals(10.0, instance.getSubjectiveDuration().toBeats(timeContext), 0.001);
    }

    @Test
    void testGetMaxResizeRightDiff() {
        instance.setLooping(timeContext, false);
        var limits = instance.getResizeRightLimits(timeContext);
        assertEquals(0.0, limits[1], 0.001);
        instance.setFileStartTime(0.0f);
        limits = instance.getResizeRightLimits(timeContext);
        assertEquals(5.0, limits[1], 0.001);
    }
       
    @Test
    void testGetMaxResizeLeftDiff() {
        instance.setLooping(timeContext, false);
        var limits = instance.getResizeLeftLimits(timeContext);
        assertEquals(-5.0, limits[0], 0.001);
        instance.setFileStartTime(0.0f);
        limits = instance.getResizeLeftLimits(timeContext);
        assertEquals(0.0, limits[0], 0.001);
        instance.setFileStartTime(3.0f);
        instance.setStartTime(TimePosition.beats(1.0));
        limits = instance.getResizeLeftLimits(timeContext);
        assertEquals(-1.0, limits[0], 0.001);

        instance.setFileStartTime(2.0f);
        instance.setStartTime(TimePosition.beats(3.0));
        limits = instance.getResizeLeftLimits(timeContext);
        assertEquals(-2.0, limits[0], 0.001);
    }

    @Test
    void testSetStartTimeAcceptsBeatTimePosition() {
        instance.setStartTime(TimePosition.beats(7.5));
        assertEquals(7.5, instance.getStartTime().toBeats(timeContext), 0.001);
        assertInstanceOf(TimePosition.BeatTime.class, instance.getStartTime());
    }

    @Test
    void testSetStartTimeAcceptsBBTTimePosition() {
        var bbt = new TimePosition.BBTTime(2, 1, 0);
        instance.setStartTime(bbt);
        assertInstanceOf(TimePosition.BBTTime.class, instance.getStartTime());
    }

    @Test
    void testSetSubjectiveDurationAcceptsBeatDuration() {
        instance.setSubjectiveDuration(TimeDuration.beats(3.0));
        assertEquals(3.0, instance.getSubjectiveDuration().toBeats(timeContext), 0.001);
        assertInstanceOf(TimeDuration.DurationBeats.class, instance.getSubjectiveDuration());
    }

    @Test
    void testSetSubjectiveDurationAcceptsBBTDuration() {
        var bbtDur = new TimeDuration.DurationBBT(2, 0, 0);
        instance.setSubjectiveDuration(bbtDur);
        assertInstanceOf(TimeDuration.DurationBBT.class, instance.getSubjectiveDuration());
    }

    @Test
    void testSetStartTimePreservesType() {
        instance.setStartTime(TimePosition.beats(12.0));
        assertEquals(12.0, instance.getStartTime().toBeats(timeContext), 0.001);
        assertInstanceOf(TimePosition.BeatTime.class, instance.getStartTime());
    }

    @Test
    void testSetSubjectiveDurationPreservesType() {
        instance.setSubjectiveDuration(TimeDuration.beats(6.0));
        assertEquals(6.0, instance.getSubjectiveDuration().toBeats(timeContext), 0.001);
        assertInstanceOf(TimeDuration.DurationBeats.class, instance.getSubjectiveDuration());
    }

    @Test
    void testDeepCopyPreservesValues() {
        instance.setStartTime(TimePosition.beats(5.0));
        instance.setSubjectiveDuration(TimeDuration.beats(3.0));

        AudioClip copy = instance.deepCopy();
        assertEquals(5.0, copy.getStartTime().toBeats(timeContext), 0.001);
        assertEquals(3.0, copy.getSubjectiveDuration().toBeats(timeContext), 0.001);
        assertEquals(instance.getFileStartTime(), copy.getFileStartTime(), 0.001);
    }

    @Test
    void testResizePreservesTimeBase() {
        var bbt = new TimePosition.BBTTime(2, 1, 0);
        instance.setStartTime(bbt);
        var bbtDur = new TimeDuration.DurationBBT(1, 0, 0);
        instance.setSubjectiveDuration(bbtDur);

        instance.resizeRight(timeContext, 20.0);
        assertInstanceOf(TimeDuration.DurationBBT.class, instance.getSubjectiveDuration());

        instance.resizeLeft(timeContext, 2.0);
        assertInstanceOf(TimePosition.BBTTime.class, instance.getStartTime());
        assertInstanceOf(TimeDuration.DurationBBT.class, instance.getSubjectiveDuration());
    }
}
