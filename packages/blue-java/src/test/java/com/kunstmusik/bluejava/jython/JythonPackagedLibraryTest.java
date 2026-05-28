package com.kunstmusik.bluejava.jython;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JythonPackagedLibraryTest {
    @Test
    void packagesAllReferencePythonLibraryFiles() throws IOException {
        long helperResourceCount;
        try (Stream<Path> files = Files.walk(Path.of("src/main/resources/jython/pythonLib"))) {
            helperResourceCount = files
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".py"))
                    .count();
        }

        long appAssetCount;
        try (Stream<Path> files = Files.walk(Path.of("../blue-app/assets/java/pythonLib"))) {
            appAssetCount = files
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".py"))
                    .count();
        }

        assertEquals(52L, helperResourceCount);
        assertEquals(52L, appAssetCount);
        assertTrue(Files.isRegularFile(Path.of("src/main/resources/jython/pythonLib/blue/orchestra/__init__.py")));
        assertTrue(Files.isRegularFile(Path.of("src/main/resources/jython/pythonLib/blue/pmask/__init__.py")));
        assertTrue(Files.isRegularFile(Path.of("src/main/resources/jython/pythonLib/blue/time/__init__.py")));
        assertTrue(Files.isRegularFile(Path.of("src/main/resources/jython/pythonLib/blue/soundObject/pianoRoll/__init__.py")));
    }

    @Test
    void bundledPythonLibraryDoesNotImportJavaClasses() throws IOException {
        assertNoJavaClassImports(Path.of("src/main/resources/jython/pythonLib"));
        assertNoJavaClassImports(Path.of("../blue-app/assets/java/pythonLib"));
    }

    private static void assertNoJavaClassImports(Path root) throws IOException {
        try (Stream<Path> files = Files.walk(root)) {
            files.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".py"))
                    .forEach(path -> {
                        try {
                            String text = Files.readString(path);
                            assertFalse(text.contains("from java."), path.toString());
                            assertFalse(text.contains("import java."), path.toString());
                            assertFalse(text.contains("from javax."), path.toString());
                            assertFalse(text.contains("import javax."), path.toString());
                            assertFalse(text.contains("from org.python."), path.toString());
                            assertFalse(text.contains("import org.python."), path.toString());
                        } catch (IOException ex) {
                            throw new UncheckedIOException(ex);
                        }
                    });
        }
    }
}
