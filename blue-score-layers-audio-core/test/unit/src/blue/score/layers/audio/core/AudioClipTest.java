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

import org.junit.After;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.Before;

/**
 *
 * @author stevenyi
 */
public class AudioClipTest {

    AudioClip instance = null;

    public AudioClipTest() {
    }

    @Before
    public void setUp() {
        instance = new AudioClip();
        instance.audioDuration = 10.0f;
        instance.setDuration(5.0f);
        instance.setStart(10.0f);
        instance.setFileStartTime(5.0f);
    }

    @After
    public void tearDown() {
        instance = null;
    }

    /**
     * Test of resizeLeft method, of class AudioClip.
     */
    @Test
    public void testResizeLeft() {
        float newStartTime = 5.0f;
        instance.resizeLeft(newStartTime);

        assertEquals(5.0, instance.getStart(), 0.001);
        assertEquals(0.0, instance.getFileStartTime(), 0.001);
        assertEquals(10.0, instance.getDuration(), 0.001);

        instance.resizeLeft(4.0f);

        assertEquals(5.0, instance.getStart(), 0.001);
        assertEquals(0.0, instance.getFileStartTime(), 0.001);
        assertEquals(10.0, instance.getDuration(), 0.001);
    }

    /**
     * Test of resizeRight method, of class AudioClip.
     */
    @Test
    public void testResizeRight() {
        float newEndTime = 20.0F;
        instance.setFileStartTime(0.0f);
        instance.resizeRight(newEndTime);

        assertEquals(10.0, instance.getStart(), 0.001);
        assertEquals(0.0, instance.getFileStartTime(), 0.001);
        assertEquals(10.0, instance.getDuration(), 0.001);
    }


    @Test
    public void testGetMaxResizeRightDiff() {
        assertEquals(0.0, instance.getMaxResizeRightDiff(), 0.001);
        instance.setFileStartTime(0.0f);
        assertEquals(5.0, instance.getMaxResizeRightDiff(), 0.001);
    }
       
    @Test
    public void testGetMaxResizeLeftDiff() {

        assertEquals(-5.0, instance.getMaxResizeLeftDiff(), 0.001);
        instance.setFileStartTime(0.0f);
        assertEquals(0.0, instance.getMaxResizeLeftDiff(), 0.001);
        instance.setFileStartTime(3.0f);
        instance.setStart(1.0f);
        assertEquals(-1.0, instance.getMaxResizeLeftDiff(), 0.001);

        instance.setFileStartTime(2.0f);
        instance.setStart(3.0f);
        assertEquals(-2.0, instance.getMaxResizeLeftDiff(), 0.001);
    }
}
