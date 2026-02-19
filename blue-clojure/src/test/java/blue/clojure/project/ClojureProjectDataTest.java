/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.clojure.project;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 *
 * @author stevenyi
 */
class ClojureProjectDataTest {

    public ClojureProjectDataTest() {
    }

    @BeforeAll
    public static void setUpClass() {
    }

    @AfterAll
    public static void tearDownClass() {
    }

    @BeforeEach
    void setUp() {
    }

    @AfterEach
    void tearDown() {
    }

    /**
     * Test of libraryList method, of class ClojureProjectData.
     */
//    @Test
//    public void testLibraryList() {
//        System.out.println("libraryList");
//        ClojureProjectData instance = new ClojureProjectData();
//        ObservableList<ClojureLibraryEntry> expResult = null;
//        ObservableList<ClojureLibraryEntry> result = instance.libraryList();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
    /**
     * Test of getPomegranateString method, of class ClojureProjectData.
     */
    @Test
    void testGetPomegranateString() {
        ClojureProjectData instance = new ClojureProjectData();

        assertEquals(null, instance.getPomegranateString());

        ClojureLibraryEntry entry = new ClojureLibraryEntry();
        entry.setDependencyCoordinates("com.kunstmusik/score");
        entry.setVersion("0.3.0");
        instance.libraryList().add(entry);

        String expResult = "(use '[cemerick.pomegranate :only (add-dependencies)])\n"
                + "(add-dependencies :coordinates '[[com.kunstmusik/score \"0.3.0\" :exclusions [org.clojure/clojure]]\n"
                + "] :repositories (merge cemerick.pomegranate.aether/maven-central {\"clojars\" \"https://repo.clojars.org\"}))";
        String result = instance.getPomegranateString();
        assertEquals(expResult, result);

        entry = new ClojureLibraryEntry();
        entry.setDependencyCoordinates("com.kunstmusik/pink");
        entry.setVersion("0.3.0");
        instance.libraryList().add(entry);

        expResult = "(use '[cemerick.pomegranate :only (add-dependencies)])\n"
                + "(add-dependencies :coordinates '[[com.kunstmusik/score \"0.3.0\" :exclusions [org.clojure/clojure]]\n"
                + "[com.kunstmusik/pink \"0.3.0\" :exclusions [org.clojure/clojure]]\n"
                + "] :repositories (merge cemerick.pomegranate.aether/maven-central {\"clojars\" \"https://repo.clojars.org\"}))";
        result = instance.getPomegranateString();
        assertEquals(expResult, result);
    }

}
