package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class JythonReinitializeTest {
    @TempDir
    Path tempDir;

    @Test
    void clearsInterpreterStateButRestoresLibraryPaths() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        session.initialize();
        session.evalWithOutput("shared_value = 42", null, null);

        JythonSession.JythonScriptResult before = session.evalWithOutput(
                "value = str(shared_value)",
                null,
                "value");
        assertEquals("42", before.value());

        var reinitializedPaths = session.reinitialize();
        assertFalse(reinitializedPaths.isEmpty());

        JythonSession.JythonScriptResult after = session.evalWithOutput(
                "value = 'missing' if 'shared_value' not in globals() else str(shared_value)",
                null,
                "value");
        assertEquals("missing", after.value());
        assertEquals(session.getLibraryPaths(), reinitializedPaths);
    }
}