package com.kunstmusik.bluejava.clojure;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClojureSessionTest {
    @Test
    void keepsNamespaceStateAcrossEvaluations() {
        ClojureSession session = new ClojureSession("user0");

        session.eval("(defn build-score [start] (str \"i1 \" start \" 1 440\"))", Map.of(), null);
        String scoreText = session.eval("(build-score 2)", Map.of(), null);

        assertEquals("i1 2 1 440", scoreText);
    }
}