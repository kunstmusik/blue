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

    @Test
    void testFormatSeconds() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.SECONDS);
        field.setTimePosition(TimePosition.seconds(1.5));

        assertEquals("1.5", field.getText());
    }

    @Test
    void testParseSeconds() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.SECONDS);
        field.setText("1.5");

        field.postActionEvent();

        TimePosition.SecondsValue parsed = assertInstanceOf(TimePosition.SecondsValue.class,
                field.getTimePosition());
        assertEquals(1.5, parsed.getTotalSeconds(), 0.0001);
    }

    @Test
    void testParseSecondsRejectsNonFiniteValue() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.SECONDS);
        field.setTimePosition(TimePosition.seconds(1.5));
        field.setText("NaN");

        field.postActionEvent();

        TimePosition.SecondsValue parsed = assertInstanceOf(TimePosition.SecondsValue.class,
                field.getTimePosition());
        assertEquals(1.5, parsed.getTotalSeconds(), 0.0001);
        assertEquals("1.5", field.getText());
    }

    @Test
    void testFormatDurationSeconds() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.SECONDS);
        field.setDurationMode(true);
        field.setTimePosition(TimePosition.seconds(2.25));

        assertEquals("2.25", field.getText());
    }

    @Test
    void testFormatBbfUsesTwoDigits() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.BBF);
        field.setTimePosition(TimePosition.bbf(1, 1, 1));

        assertEquals("1.1.01", field.getText());
    }

    @Test
    void testParseBbfNormalizesSingleDigitFraction() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.BBF);
        field.setText("1.1.5");

        field.postActionEvent();

        TimePosition.BBFTime parsed = assertInstanceOf(TimePosition.BBFTime.class,
                field.getTimePosition());
        assertEquals(1, parsed.getBar());
        assertEquals(1, parsed.getBeat());
        assertEquals(50, parsed.getFraction());
        assertEquals("1.1.50", field.getText());
    }

    @Test
    void testParseBbfRoundsAndAcceptsLongFraction() {
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeBase(TimeBase.BBF);
        field.setText("1.1.3497");

        field.postActionEvent();

        TimePosition.BBFTime parsed = assertInstanceOf(TimePosition.BBFTime.class,
                field.getTimePosition());
        assertEquals(1, parsed.getBar());
        assertEquals(1, parsed.getBeat());
        assertEquals(35, parsed.getFraction());
        assertEquals("1.1.35", field.getText());
    }

    @Test
    void testParseDurationBbfNormalizesAndConverts() {
        TimeContext context = createContext(60.0);
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeContextSupplier(() -> context);
        field.setTimeBase(TimeBase.BBF);
        field.setDurationMode(true);
        field.setText("1.0.5");

        field.postActionEvent();

        TimePosition.BBFTime parsed = assertInstanceOf(TimePosition.BBFTime.class,
                field.getTimePosition());
        assertEquals(4.5, parsed.toBeats(context), 0.0001);
        assertEquals("1.0.50", field.getText());
    }

    @Test
    void testParseDurationBbfUsesRoundOnApply() {
        TimeContext context = createContext(60.0);
        TimeUnitTextField field = new TimeUnitTextField();
        field.setTimeContextSupplier(() -> context);
        field.setTimeBase(TimeBase.BBF);
        field.setDurationMode(true);
        field.setText("1.1.349");

        field.postActionEvent();

        TimePosition.BBFTime parsed = assertInstanceOf(TimePosition.BBFTime.class,
                field.getTimePosition());
        assertEquals(5.35, parsed.toBeats(context), 0.0001);
        assertEquals("1.1.35", field.getText());
    }

    private static TimeContext createContext(double frameRate) {
        TimeContext context = new TimeContext(44100, new MeterMap(), new TempoMap());
        context.setSmpteFrameRate(frameRate);
        return context;
    }
}
