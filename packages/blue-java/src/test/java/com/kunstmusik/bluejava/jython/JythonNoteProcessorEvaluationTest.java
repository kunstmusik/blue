package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JythonNoteProcessorEvaluationTest {
    @TempDir
    Path tempDir;

    @Test
    void mutatesNotesThroughNoteListBindings() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());
        JythonNoteList noteList = new JythonNoteList();
        noteList.append(new JythonNote(List.of("1", "0", "1", "440"), 1.0, false));

        JythonSession.JythonNoteListResult result = session.processNoteListWithOutput(
                "for note in noteList:\n    note.setPField('880', 4)\n    note.startTime = note.startTime + 2",
                noteList);

        assertEquals("880", result.notes().get(0).getPField(4));
        assertEquals("2.0", result.notes().get(0).getPField(2));
    }
}