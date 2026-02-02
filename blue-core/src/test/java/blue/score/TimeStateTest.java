/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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
package blue.score;

import blue.time.TimeBase;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Tests for TimeState class.
 *
 * @author Steven Yi
 */
public class TimeStateTest {

    private TimeState timeState;

    @Before
    public void setUp() {
        timeState = new TimeState();
    }

    // ========== setTimeDisplay Tests ==========

    @Test
    public void testSetTimeDisplayValid() {
        timeState.setTimeDisplay(TimeBase.TIME);
        assertEquals(TimeBase.TIME, timeState.getTimeDisplay());
        
        timeState.setTimeDisplay(TimeBase.CSOUND_BEATS);
        assertEquals(TimeBase.CSOUND_BEATS, timeState.getTimeDisplay());
        
        timeState.setTimeDisplay(TimeBase.BBT);
        assertEquals(TimeBase.BBT, timeState.getTimeDisplay());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testSetTimeDisplayNullThrowsException() {
        timeState.setTimeDisplay(null);
    }

    // ========== setSecondaryTimeDisplay Tests ==========

    @Test
    public void testSetSecondaryTimeDisplayValid() {
        timeState.setSecondaryTimeDisplay(TimeBase.CSOUND_BEATS);
        assertEquals(TimeBase.CSOUND_BEATS, timeState.getSecondaryTimeDisplay());
        
        timeState.setSecondaryTimeDisplay(TimeBase.SMPTE);
        assertEquals(TimeBase.SMPTE, timeState.getSecondaryTimeDisplay());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testSetSecondaryTimeDisplayNullThrowsException() {
        timeState.setSecondaryTimeDisplay(null);
    }

    // ========== Default Values Tests ==========

    @Test
    public void testDefaultTimeDisplay() {
        assertEquals(TimeBase.CSOUND_BEATS, timeState.getTimeDisplay());
    }

    @Test
    public void testDefaultSecondaryTimeDisplay() {
        assertEquals(TimeBase.TIME, timeState.getSecondaryTimeDisplay());
    }

    @Test
    public void testDefaultSecondaryRulerEnabled() {
        assertFalse(timeState.isSecondaryRulerEnabled());
    }

    // ========== Copy Constructor Tests ==========

    @Test
    public void testCopyConstructor() {
        timeState.setTimeDisplay(TimeBase.BBT);
        timeState.setSecondaryTimeDisplay(TimeBase.SMPTE);
        timeState.setSecondaryRulerEnabled(true);
        timeState.setSnapEnabled(true);
        timeState.setSnapValue(0.5);

        TimeState copy = new TimeState(timeState);

        assertEquals(TimeBase.BBT, copy.getTimeDisplay());
        assertEquals(TimeBase.SMPTE, copy.getSecondaryTimeDisplay());
        assertTrue(copy.isSecondaryRulerEnabled());
        assertTrue(copy.isSnapEnabled());
        assertEquals(0.5, copy.getSnapValue(), 0.001);
    }

    // ========== Property Change Listener Tests ==========

    @Test
    public void testTimeDisplayPropertyChangeEvent() {
        final boolean[] listenerCalled = {false};
        final TimeBase[] oldValue = {null};
        final TimeBase[] newValue = {null};

        timeState.addPropertyChangeListener(evt -> {
            if ("timeDisplay".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
                oldValue[0] = (TimeBase) evt.getOldValue();
                newValue[0] = (TimeBase) evt.getNewValue();
            }
        });

        timeState.setTimeDisplay(TimeBase.TIME);

        assertTrue(listenerCalled[0]);
        assertEquals(TimeBase.CSOUND_BEATS, oldValue[0]);
        assertEquals(TimeBase.TIME, newValue[0]);
    }

    @Test
    public void testSecondaryTimeDisplayPropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("secondaryTimeDisplay".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setSecondaryTimeDisplay(TimeBase.FRAME);

        assertTrue(listenerCalled[0]);
    }

    @Test
    public void testSecondaryRulerEnabledPropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("secondaryRulerEnabled".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setSecondaryRulerEnabled(true);

        assertTrue(listenerCalled[0]);
    }
}
