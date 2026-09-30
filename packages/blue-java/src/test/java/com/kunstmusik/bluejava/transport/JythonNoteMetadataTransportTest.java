package com.kunstmusik.bluejava.transport;

import com.kunstmusik.bluejava.jython.JythonNote;
import com.kunstmusik.bluejava.jython.JythonNoteList;
import com.kunstmusik.bluejava.jython.JythonSession;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class JythonNoteMetadataTransportTest {
    @TempDir
    Path tempDir;

    @Test
    void carriesOpaqueRenderIdentityAcrossPythonReorderingAndCopy() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JeroMqRuntimeServer.JythonSerializedNote fileNote = new JeroMqRuntimeServer.JythonSerializedNote();
        fileNote.pfields = List.of("1", "0", "1", "0");
        fileNote.subjectiveDuration = 1.0;
        fileNote.renderMetadataId = "file-seek-0";

        JeroMqRuntimeServer.JythonSerializedNote scoreNote = new JeroMqRuntimeServer.JythonSerializedNote();
        scoreNote.pfields = List.of("2", "2", "1", "440");
        scoreNote.subjectiveDuration = 1.0;

        JythonNoteList noteList = new JythonNoteList();
        noteList.add(JeroMqRuntimeServer.deserializeJythonNote(fileNote));
        noteList.add(JeroMqRuntimeServer.deserializeJythonNote(scoreNote));

        JythonSession.JythonNoteListResult result = session.processNoteListWithOutput(
                "noteList.reverse()\nnoteList[1] = noteList[1].copy()\nassert not hasattr(noteList[1], 'renderMetadataId')",
                noteList);

        List<Map<String, Object>> serialized = result.notes().stream()
                .map(JeroMqRuntimeServer::serializeJythonNote)
                .toList();

        assertEquals("2", ((List<?>) serialized.get(0).get("pfields")).get(0));
        assertFalse(serialized.get(0).containsKey("renderMetadataId"));
        assertEquals("file-seek-0", serialized.get(1).get("renderMetadataId"));
    }
}
