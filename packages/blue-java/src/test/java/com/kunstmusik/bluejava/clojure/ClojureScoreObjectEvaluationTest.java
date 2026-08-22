package com.kunstmusik.bluejava.clojure;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClojureScoreObjectEvaluationTest {
    @Test
    void exposesBlueDurationAndProjectDirBindings() throws Exception {
        Path projectDir = Files.createTempDirectory("blue-java-clj");

        try {
            ClojureSession session = new ClojureSession("user0");
            String scoreText = session.evaluateScoreObject(
                    "(def score (str \"i1 0 \" blueDuration \" 3 4 5\"))",
                    8.0,
                    projectDir.toString());

            assertEquals("i1 0 8.0 3 4 5", scoreText);

            String pathText = session.evaluateScoreObject(
                    "(def score (.getAbsolutePath blueProjectDir))",
                    1.0,
                    projectDir.toString());

            assertTrue(pathText.contains(projectDir.getFileName().toString()));
        } finally {
            Files.deleteIfExists(projectDir);
        }
    }

    @Test
    void exposesObjectBuilderCommandlineBinding() {
        ClojureSession session = new ClojureSession("user0");

        String scoreText = session.evaluateScoreObjectWithOutput(
                "(def score commandline)",
                1.0,
                null,
                "i2 0 3 440").value();

        assertEquals("i2 0 3 440", scoreText);
    }
}
