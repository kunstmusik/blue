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
package blue.soundObject;

import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.PianoNote;
import static org.junit.Assert.*;
import org.junit.Before;
import org.junit.Test;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class PianoRollTest {

    PianoRoll instance;

    public PianoRollTest() {
    }

    @Before
    public void init() {
        instance = new PianoRoll();
        var fieldDefinitions = instance.getFieldDefinitions();
        var fieldDef = new FieldDef();
        fieldDef.setFieldName("TESTING");
        fieldDef.setDefaultValue(Math.random());
        fieldDefinitions.add(fieldDef);

        for (int i = 0; i < 5; i++) {
            var note = new PianoNote();
            note.setStart(i);
            note.setOctave((int) (Math.random() * 15));

            for (var fd : fieldDefinitions) {
                var f = new Field(fd);
                note.getFields().add(f);
            }
            instance.getNotes().add(note);
        }

    }

    @Test
    public void testSerialization() {
        PianoRoll p2 = instance.deepCopy();

//        assertTrue(instance.equals(p2));
    }

    @Test
    public void testSaveLoad() throws Exception {
        var xml = instance.saveAsXML(null);
//        System.out.println(xml.toString());
        PianoRoll p2 = (PianoRoll) PianoRoll.loadFromXML(
                xml, null);

        // FIXME - I removed equals and hashCode to match hash by ref behavior 
        // of other soundObjects. Need to fix this.
//        assertTrue(instance.equals(p2));
//        assertTrue(EqualsBuilder.reflectionEquals(instance, p2, (String[])null));
    }

    @Test
    public void testIsCompatible() {
        var target = new PianoRoll(instance);

        assertTrue(instance.isCompatible(target));

        target.getFieldDefinitions().get(0).setFieldName("error");

        assertFalse(instance.isCompatible(target));

        target = new PianoRoll(instance);
        var fd = new FieldDef();
        target.getFieldDefinitions().add(fd);

        assertFalse(instance.isCompatible(target));
    }

    @Test
    public void testSpaceInNoteTemplate() throws SoundObjectException {
        var note = instance.getNotes().get(0);
        note.setNoteTemplate(" i <INSTR_ID> <START> <DUR> <FREQ> <AMP>");

        var notes = instance.generateNotes(0, -1);

        assertTrue("Exception was not thrown", true);
    }
}
