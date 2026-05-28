package com.kunstmusik.bluejava.clojure;

import com.kunstmusik.bluejava.session.DependencySpec;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClojureLibraryLoaderTest {
    @Test
    void rejectsUnsafeDependencyCoordinatesBeforeEvaluation() {
        DependencySpec dependency = new DependencySpec();
        dependency.coordinates = "org.clojure/core\"]] (println \"injected\") [[x/y";
        dependency.version = "1.0.0";

        List<Map<String, Object>> results = new ClojureLibraryLoader()
                .loadDependencies(new ClojureSession("user0"), List.of(dependency));

        assertEquals(1, results.size());
        assertEquals("failed", results.get(0).get("status"));
        assertTrue(results.get(0).get("message").toString().contains("Invalid Clojure dependency coordinates"));
    }

    @Test
    void rejectsUnsafeDependencyVersionBeforeEvaluation() {
        DependencySpec dependency = new DependencySpec();
        dependency.coordinates = "org.clojure/data.json";
        dependency.version = "1.0.0\"]] (println \"injected\") [[x/y";

        List<Map<String, Object>> results = new ClojureLibraryLoader()
                .loadDependencies(new ClojureSession("user0"), List.of(dependency));

        assertEquals(1, results.size());
        assertEquals("failed", results.get(0).get("status"));
        assertTrue(results.get(0).get("message").toString().contains("Invalid Clojure dependency version"));
    }
}
