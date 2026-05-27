package com.kunstmusik.bluejava.clojure;

import com.kunstmusik.bluejava.session.DependencySpec;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ClojureLibraryLoader {
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
        return String.join("\n",
                "(use '[cemerick.pomegranate :only (add-dependencies)])",
                String.format(
                        "(add-dependencies :coordinates '[[%s \"%s\" :exclusions [org.clojure/clojure]]] :repositories (merge cemerick.pomegranate.aether/maven-central {\"clojars\" \"https://repo.clojars.org\"}))",
                        dependency.coordinates,
                        dependency.version));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}