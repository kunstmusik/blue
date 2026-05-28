package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JythonNoteAdapterTest {
    @Test
    void exposesNoteFieldsAndDurationAliases() {
        JythonNote note = new JythonNote(List.of("1", "0.5", "2.0", "440"), 2.0, false);

        assertEquals("440", note.getPField(4));
        assertEquals(0.5, note.getStartTime());
        assertEquals(2.0, note.getDuration());

        note.setStartTime(1.25);
        note.setDuration(3.5);
        note.setPField("660", 4);

        assertEquals("1.25", note.getPField(2));
        assertEquals("3.5", note.getPField(3));
        assertEquals("660", note.getPField(4));
        assertFalse(note.isTied());
    }

    @Test
    void supportsAppendableNoteLists() {
        JythonNoteList noteList = new JythonNoteList();
        noteList.append(new JythonNote(List.of("1", "0", "1", "440"), 1.0, false));

        assertEquals(1, noteList.size());
        assertEquals("440", noteList.get(0).getPField(4));

        noteList.get(0).setTied(true);
        assertTrue(noteList.get(0).isTied());
        assertEquals("-1.0", noteList.get(0).getPField(3));
    }
}