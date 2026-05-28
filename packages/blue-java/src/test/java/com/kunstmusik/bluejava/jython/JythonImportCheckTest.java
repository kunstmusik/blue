package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JythonImportCheckTest {
    @TempDir
    Path tempDir;

    @Test
    void importsOrchestraAndPmaskFromPackagedLibraries() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        Path userRoot = tempDir.resolve("pythonLib");
        JythonSession session = new JythonSession(packagedRoot.toString(), userRoot.toString());

        JythonSession.JythonImportCheckResult result = session.importCheckWithOutput(List.of("orchestra", "pmask"));

        assertEquals(List.of("orchestra", "pmask"), result.importedModules());
        assertEquals(packagedRoot.resolve("blue").toString(), result.libraryPaths().get(0));
        assertEquals(userRoot.toAbsolutePath().normalize().toString(), result.libraryPaths().get(1));
        assertEquals(packagedRoot.toString(), result.libraryPaths().get(2));
        assertTrue(Files.isDirectory(userRoot));
    }

    @Test
    void importsHistoricalBlueCompatibilityShims() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        Path userRoot = tempDir.resolve("pythonLib");
        JythonSession session = new JythonSession(packagedRoot.toString(), userRoot.toString());

        JythonSession.JythonImportCheckResult result = session.importCheckWithOutput(
                List.of("blue.time", "blue.soundObject.pianoRoll", "blue.gui", "ScriptingUtils"));

        assertEquals(List.of("blue.time", "blue.soundObject.pianoRoll", "blue.gui", "ScriptingUtils"),
                result.importedModules());
    }

    @Test
    void purePythonTempoMapMatchesLegacyLinearWarpBehavior() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evalWithOutput(
                """
                        from blue.time import TempoMap
                        tempoMap = TempoMap.createTempoMap("0 60 4 120")
                        value = "%.6f %.6f %.6f" % (
                            tempoMap.beatsToSeconds(2.0),
                            tempoMap.beatsToSeconds(4.0),
                            tempoMap.beatsToSeconds(8.0))
                        """,
                null,
                "value");

        assertEquals("1.750000 3.000000 5.000000", result.value());
    }

    @Test
    void purePythonScaleParsesScalaFiles() throws Exception {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        Path scaleFile = tempDir.resolve("test.scl");
        Files.writeString(scaleFile, String.join("\n",
                "! test scale",
                "test",
                "3",
                "100.0",
                "3/2",
                "2/1",
                ""));
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evalWithOutput(
                """
                        from blue.soundObject.pianoRoll import Scale
                        scale = Scale.loadScale(scalePath)
                        scale.setBaseFrequency(261.625565)
                        value = "%d %.3f %.3f %.3f" % (
                            scale.getNumScaleDegrees(),
                            scale.getFrequency(8, 0),
                            scale.getFrequency(8, 1),
                            scale.getFrequency(9, 0))
                        """,
                Map.of("scalePath", scaleFile.toString()),
                "value");

        assertEquals("3 261.626 277.183 523.251", result.value());
    }

    @Test
    void scriptingUtilsWritesDialogMessagesToStdout() {
        Path packagedRoot = Path.of("src/main/resources/jython/pythonLib").toAbsolutePath().normalize();
        JythonSession session = new JythonSession(packagedRoot.toString(), tempDir.resolve("pythonLib").toString());

        JythonSession.JythonScriptResult result = session.evalWithOutput(
                """
                        from ScriptingUtils import info
                        info("hello")
                        value = "done"
                        """,
                null,
                "value");

        assertEquals("done", result.value());
        assertTrue(result.stdout().contains("Information: hello"));
    }
}
