package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JythonScoreObjectEvaluationTest {
    @TempDir
    Path tempDir;

    @Test
    void evaluatesPythonScoreObjectBindings() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evaluateScoreObjectWithOutput(
                "score = 'i1 0 %s 440' % blueDuration",
                8.0,
                tempDir.toString());

        assertEquals("i1 0 8.0 440", result.value());
    }
}