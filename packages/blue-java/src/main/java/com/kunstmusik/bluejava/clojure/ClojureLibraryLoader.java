package com.kunstmusik.bluejava.clojure;

import com.kunstmusik.bluejava.session.DependencySpec;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class ClojureLibraryLoader {
    private static final Pattern SAFE_COORDINATES =
            Pattern.compile("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+");
    private static final Pattern SAFE_VERSION =
            Pattern.compile("[A-Za-z0-9_.-]+");

    public List<Map<String, Object>> loadDependencies(ClojureSession session, List<DependencySpec> dependencies) {
        List<Map<String, Object>> results = new ArrayList<>();

        for (DependencySpec dependency : dependencies) {
            if (dependency == null || isBlank(dependency.coordinates) || isBlank(dependency.version)) {
                continue;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("coordinates", dependency.coordinates);
            result.put("version", dependency.version);

            try {
                session.eval(buildScript(dependency), Map.of(), null);
                result.put("status", "loaded");
            } catch (RuntimeException ex) {
                result.put("status", "failed");
                result.put("message", ex.getMessage());
            }

            results.add(result);
        }

        return results;
    }

    private String buildScript(DependencySpec dependency) {
        String coordinates = dependency.coordinates.trim();
        String version = dependency.version.trim();
        if (!SAFE_COORDINATES.matcher(coordinates).matches()) {
            throw new IllegalArgumentException("Invalid Clojure dependency coordinates: " + coordinates);
        }
        if (!SAFE_VERSION.matcher(version).matches()) {
            throw new IllegalArgumentException("Invalid Clojure dependency version: " + version);
        }

        return String.join("\n",
                "(use '[cemerick.pomegranate :only (add-dependencies)])",
                String.format(
                        "(add-dependencies :coordinates '[[%s \"%s\" :exclusions [org.clojure/clojure]]] :repositories (merge cemerick.pomegranate.aether/maven-central {\"clojars\" \"https://repo.clojars.org\"}))",
                        coordinates,
                        version));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
