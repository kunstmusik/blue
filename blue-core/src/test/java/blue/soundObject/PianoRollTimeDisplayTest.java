/*
 * blue - object composition environment for csound
 * Copyright (c) 2026 Steven Yi (stevenyi@gmail.com)
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

import blue.score.SnapValue;
import blue.time.TimeBase;
import electric.xml.Element;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

/**
 * Tests for PianoRoll time display migration (legacy XML) and round-trip
 * serialization of new fields: useGlobalRuler, primaryTimeDisplay,
 * secondaryTimeDisplay, secondaryRulerEnabled, snapValueEnum.
 */
class PianoRollTimeDisplayTest {

    @Test
    void shouldRoundTripNewFields() throws Exception {
        PianoRoll original = new PianoRoll();
        original.setUseGlobalRuler(true);
        original.setPrimaryTimeDisplay(TimeBase.TIME);
        original.setSecondaryTimeDisplay(TimeBase.BBT);
        original.setSecondaryRulerEnabled(true);
        original.setSnapValueEnum(SnapValue.SIXTEENTH);

        Element xml = original.saveAsXML(null);
        PianoRoll loaded = (PianoRoll) PianoRoll.loadFromXML(xml, null);

        assertTrue(loaded.isUseGlobalRuler());
        assertEquals(TimeBase.TIME, loaded.getPrimaryTimeDisplay());
        assertEquals(TimeBase.BBT, loaded.getSecondaryTimeDisplay());
        assertTrue(loaded.isSecondaryRulerEnabled());
        assertEquals(SnapValue.SIXTEENTH, loaded.getSnapValueEnum());
    }

    @Test
    void shouldRoundTripDefaults() throws Exception {
        PianoRoll original = new PianoRoll();

        Element xml = original.saveAsXML(null);
        PianoRoll loaded = (PianoRoll) PianoRoll.loadFromXML(xml, null);

        assertFalse(loaded.isUseGlobalRuler());
        assertEquals(TimeBase.BBF, loaded.getPrimaryTimeDisplay());
        assertEquals(TimeBase.TIME, loaded.getSecondaryTimeDisplay());
        assertFalse(loaded.isSecondaryRulerEnabled());
        assertEquals(SnapValue.SIXTEENTH, loaded.getSnapValueEnum());
    }

    @Test
    void shouldMigrateLegacyDisplayTime() throws Exception {
        // Legacy DISPLAY_TIME = 0
        PianoRoll base = new PianoRoll();
        Element xml = base.saveAsXML(null);

        // Remove new fields and inject legacy ones
        removeElement(xml, "snapValueEnum");
        removeElement(xml, "useGlobalRuler");
        removeElement(xml, "primaryTimeDisplay");
        removeElement(xml, "secondaryTimeDisplay");
        removeElement(xml, "secondaryRulerEnabled");

        xml.addElement("timeDisplay").setText("0"); // DISPLAY_TIME
        xml.addElement("snapValue").setText("0.25");
        xml.addElement("timeUnit").setText("5");

        PianoRoll loaded = (PianoRoll) PianoRoll.loadFromXML(xml, null);

        assertEquals(TimeBase.TIME, loaded.getPrimaryTimeDisplay());
        // Legacy files should default to local mode
        assertFalse(loaded.isUseGlobalRuler());
        // snapValue 0.25 should map to SIXTEENTH
        assertEquals(SnapValue.SIXTEENTH, loaded.getSnapValueEnum());
    }

    @Test
    void shouldMigrateLegacyDisplayNumber() throws Exception {
        // Legacy DISPLAY_NUMBER = 1
        PianoRoll base = new PianoRoll();
        Element xml = base.saveAsXML(null);

        removeElement(xml, "snapValueEnum");
        removeElement(xml, "useGlobalRuler");
        removeElement(xml, "primaryTimeDisplay");
        removeElement(xml, "secondaryTimeDisplay");
        removeElement(xml, "secondaryRulerEnabled");

        xml.addElement("timeDisplay").setText("1"); // DISPLAY_NUMBER
        xml.addElement("snapValue").setText("1.0");

        PianoRoll loaded = (PianoRoll) PianoRoll.loadFromXML(xml, null);

        assertEquals(TimeBase.BEATS, loaded.getPrimaryTimeDisplay());
        assertEquals(SnapValue.BEAT, loaded.getSnapValueEnum());
    }

    @Test
    void shouldMigrateLegacySnapValueEighth() throws Exception {
        PianoRoll base = new PianoRoll();
        Element xml = base.saveAsXML(null);

        removeElement(xml, "snapValueEnum");
        xml.addElement("snapValue").setText("0.5");

        PianoRoll loaded = (PianoRoll) PianoRoll.loadFromXML(xml, null);

        assertEquals(SnapValue.EIGHTH, loaded.getSnapValueEnum());
    }

    @Test
    void shouldCopyNewFieldsInCopyConstructor() {
        PianoRoll original = new PianoRoll();
        original.setUseGlobalRuler(true);
        original.setPrimaryTimeDisplay(TimeBase.TIME);
        original.setSecondaryTimeDisplay(TimeBase.BBT);
        original.setSecondaryRulerEnabled(true);
        original.setSnapValueEnum(SnapValue.EIGHTH_TRIPLET);

        PianoRoll copy = new PianoRoll(original);

        assertTrue(copy.isUseGlobalRuler());
        assertEquals(TimeBase.TIME, copy.getPrimaryTimeDisplay());
        assertEquals(TimeBase.BBT, copy.getSecondaryTimeDisplay());
        assertTrue(copy.isSecondaryRulerEnabled());
        assertEquals(SnapValue.EIGHTH_TRIPLET, copy.getSnapValueEnum());
    }

    @Test
    void shouldCopyNewFieldsInDeepCopy() {
        PianoRoll original = new PianoRoll();
        original.setUseGlobalRuler(true);
        original.setPrimaryTimeDisplay(TimeBase.SMPTE);
        original.setSnapValueEnum(SnapValue.BAR);

        PianoRoll copy = original.deepCopy();

        assertTrue(copy.isUseGlobalRuler());
        assertEquals(TimeBase.SMPTE, copy.getPrimaryTimeDisplay());
        assertEquals(SnapValue.BAR, copy.getSnapValueEnum());
    }

    private void removeElement(Element parent, String name) {
        var child = parent.getElement(name);
        if (child != null) {
            parent.removeChild(child);
        }
    }
}
