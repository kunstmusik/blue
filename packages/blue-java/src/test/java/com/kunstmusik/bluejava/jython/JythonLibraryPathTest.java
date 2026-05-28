package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JythonLibraryPathTest {
    @TempDir
    Path tempDir;

    @Test
    void resolvesPackagedBlueBeforeUserRootAndCreatesUserDirectory() throws Exception {
        Path packagedRoot = tempDir.resolve("packaged/pythonLib");
        Files.createDirectories(packagedRoot.resolve("blue/orchestra"));
        Path userRoot = tempDir.resolve("user/pythonLib");

        List<String> paths = JythonLibraryPath.resolveLibraryPaths(packagedRoot.toString(), userRoot.toString());

        assertEquals(List.of(
                packagedRoot.resolve("blue").toAbsolutePath().normalize().toString(),
                userRoot.toAbsolutePath().normalize().toString(),
                packagedRoot.toAbsolutePath().normalize().toString()
        ), paths);
        assertTrue(Files.isDirectory(userRoot));
    }

    @Test
    void failsWhenPackagedBlueDirectoryIsMissing() {
        Path packagedRoot = tempDir.resolve("missing/pythonLib");
        JythonEvaluationException ex = assertThrows(
                JythonEvaluationException.class,
                () -> JythonLibraryPath.resolveLibraryPaths(packagedRoot.toString(), null));

        assertEquals("JYTHON_LIBRARY_PATH_ERROR", ex.getCode());
    }
}
