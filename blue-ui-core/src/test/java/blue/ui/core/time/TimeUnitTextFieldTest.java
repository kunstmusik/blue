/*
 * blue - object composition environment for csound
 * Copyright (C) 2026
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
package blue.ui.core.time;

import blue.time.MeterMap;
import blue.time.TempoMap;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimePosition;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class TimeUnitTextFieldTest {

    @Test
    void testFormatSmpteUsesContextFrameRate() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeContextSupplier(() -> createContext(30.0));
        field.setTimeBase(TimeBase.SMPTE);
        field.setTimePosition(TimePosition.time(0, 0, 1, 500));

        assertEquals("00:00:01:15", field.getText());
    }

    @Test
    void testParseSmpteUsesContextFrameRate() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeContextSupplier(() -> createContext(30.0));
        field.setTimeBase(TimeBase.SMPTE);
        field.setText("00:00:01:15");

        field.postActionEvent();

        TimePosition.TimeValue parsed = assertInstanceOf(TimePosition.TimeValue.class,
                field.getTimePosition());
        assertEquals(1, parsed.getSeconds());
        assertEquals(500, parsed.getMilliseconds());
    }

    @Test
    void testFormatDurationSmpteUsesContextFrameRate() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeContextSupplier(() -> createContext(30.0));
        field.setTimeBase(TimeBase.SMPTE);
        field.setDurationMode(true);
        field.setTimePosition(TimePosition.time(0, 0, 1, 500));

        assertEquals("00:00:01:15", field.getText());
    }

    private static TimeContext createContext(double frameRate) {
        TimeContext context = new TimeContext(44100, new MeterMap(), new TempoMap());
        context.setSmpteFrameRate(frameRate);
        return context;
    }
}
