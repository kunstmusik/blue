package com.kunstmusik.bluejava.session;

import com.kunstmusik.bluejava.clojure.ClojureSession;

import java.util.ArrayList;
import java.util.List;

public final class ProjectSession {
    private final int projectSessionId;
    private final String projectDir;
    private final List<DependencySpec> clojureDependencies;
    private ClojureSession clojureSession;

    public ProjectSession(
            int projectSessionId,
            String projectDir,
            List<DependencySpec> clojureDependencies,
            ClojureSession clojureSession
    ) {
        this.projectSessionId = projectSessionId;
        this.projectDir = projectDir;
        this.clojureDependencies = new ArrayList<>(clojureDependencies);
        this.clojureSession = clojureSession;
    }

    public int getProjectSessionId() {
        return projectSessionId;
    }

    public String getProjectDir() {
        return projectDir;
    }

    public List<DependencySpec> getClojureDependencies() {
        return new ArrayList<>(clojureDependencies);
    }

    public ClojureSession getClojureSession() {
        return clojureSession;
    }

    public void setClojureSession(ClojureSession clojureSession) {
        this.clojureSession = clojureSession;
    }
}