package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JythonErrorHandlingTest {
    @TempDir
    Path tempDir;

    @Test
    void capturesStdoutAndStderrOnSuccessfulEvaluation() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evalWithOutput(
                "import sys\nprint('hello stdout')\nsys.stderr.write('hello stderr\\n')\nvalue = 'done'",
                null,
                "value");

        assertEquals("done", result.value());
        assertTrue(result.stdout().contains("hello stdout"));
        assertTrue(result.stderr().contains("hello stderr"));
    }

    @Test
    void preservesCapturedOutputOnEvaluationFailure() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        try {
            session.evalWithOutput(
                    "import sys\nprint('before crash')\nsys.stderr.write('stderr before crash\\n')\n1 / 0",
                    null,
                    "value");
        } catch (JythonEvaluationException ex) {
            assertEquals("JYTHON_EVALUATION_ERROR", ex.getCode());
            assertTrue(ex.getStdout().contains("before crash"));
            assertTrue(ex.getStderr().contains("stderr before crash"));
            return;
        }

        throw new AssertionError("Expected JythonEvaluationException");
    }
}