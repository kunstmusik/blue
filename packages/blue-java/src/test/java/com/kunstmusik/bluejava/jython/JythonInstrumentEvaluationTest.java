package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JythonInstrumentEvaluationTest {
    @TempDir
    Path tempDir;

    @Test
    void evaluatesPythonInstrumentBindings() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evaluateInstrumentWithOutput(
                "instrument = 'aout oscili 32000, 440, 1'");

        assertEquals("aout oscili 32000, 440, 1", result.value());
    }
}