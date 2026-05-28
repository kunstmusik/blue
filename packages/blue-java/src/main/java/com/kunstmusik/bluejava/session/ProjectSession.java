package com.kunstmusik.bluejava.session;

import com.kunstmusik.bluejava.clojure.ClojureSession;
import com.kunstmusik.bluejava.jython.JythonSession;

import java.util.ArrayList;
import java.util.List;

public final class ProjectSession {
    private final int projectSessionId;
    private final String projectDir;
    private final List<DependencySpec> clojureDependencies;
    private ClojureSession clojureSession;
    private JythonSession jythonSession;

    public ProjectSession(
            int projectSessionId,
            String projectDir,
            List<DependencySpec> clojureDependencies,
            ClojureSession clojureSession,
            JythonSession jythonSession
    ) {
        this.projectSessionId = projectSessionId;
        this.projectDir = projectDir;
        this.clojureDependencies = new ArrayList<>(clojureDependencies);
        this.clojureSession = clojureSession;
        this.jythonSession = jythonSession;
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

    public JythonSession getJythonSession() {
        return jythonSession;
    }

    public void setJythonSession(JythonSession jythonSession) {
        this.jythonSession = jythonSession;
    }
}