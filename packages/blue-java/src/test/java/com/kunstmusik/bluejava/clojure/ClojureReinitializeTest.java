package com.kunstmusik.bluejava.clojure;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClojureReinitializeTest {
    @Test
    void aFreshSessionDoesNotRetainPriorDefinitions() {
        ClojureSession original = new ClojureSession("user0");
        original.eval("(def retained-value 7)", Map.of(), null);

        ClojureSession reinitialized = new ClojureSession("user1");
        String resolved = reinitialized.eval("(if (resolve 'retained-value) \"present\" \"missing\")", Map.of(), null);

        assertEquals("missing", resolved);
    }
}