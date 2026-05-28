package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JythonSessionPersistenceTest {
    @TempDir
    Path tempDir;

    @Test
    void keepsDefinitionsAcrossEvaluations() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        session.evalWithOutput(
                "def build_score(start):\n    return 'i1 %s 1 440' % start",
                Map.of(),
                null);

        JythonSession.JythonScriptResult result = session.evaluateScoreObjectWithOutput(
                "score = build_score(2)",
                4.0,
                tempDir.toString());

        assertEquals("i1 2 1 440", result.value());
    }
}