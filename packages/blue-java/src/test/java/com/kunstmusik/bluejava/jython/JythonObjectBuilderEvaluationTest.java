package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JythonObjectBuilderEvaluationTest {
    @TempDir
    Path tempDir;

    @Test
    void evaluatesObjectBuilderBindings() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evaluateObjectBuilderWithOutput(
                "score = 'i1 0 %s %s' % (blueDuration, commandline)",
                6.0,
                "render --fast",
                tempDir.toString());

        assertEquals("i1 0 6.0 render --fast", result.value());
    }
}