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

import electric.xml.Element;
import java.io.ObjectInput;
import java.io.ObjectOutput;
import javafx.collections.ObservableList;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class ClojureProjectDataTest {

    public ClojureProjectDataTest() {
    }

    @BeforeClass
    public static void setUpClass() {
    }

    @AfterClass
    public static void tearDownClass() {
    }

    @Before
    public void setUp() {
    }

    @After
    public void tearDown() {
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
    public void testGetPomegranateString() {
        ClojureProjectData instance = new ClojureProjectData();

        assertEquals(null, instance.getPomegranateString());

        ClojureLibraryEntry entry = new ClojureLibraryEntry();
        entry.setDependencyCoordinates("com.kunstmusik/score");
        entry.setVersion("0.3.0");
        instance.libraryList.add(entry);

        String expResult = "(use '[cemerick.pomegranate :only (add-dependencies)])\n"
                + "(add-dependencies :coordinates '[[com.kunstmusik/score \"0.3.0\" :exclusions [org.clojure/clojure]]\n"
                + "] :repositories (merge cemerick.pomegranate.aether/maven-central {\"clojars\" \"http://clojars.org/repo\"}))";
        String result = instance.getPomegranateString();
        assertEquals(expResult, result);

        entry = new ClojureLibraryEntry();
        entry.setDependencyCoordinates("com.kunstmusik/pink");
        entry.setVersion("0.3.0");
        instance.libraryList.add(entry);

        expResult = "(use '[cemerick.pomegranate :only (add-dependencies)])\n"
                + "(add-dependencies :coordinates '[[com.kunstmusik/score \"0.3.0\" :exclusions [org.clojure/clojure]]\n"
                + "[com.kunstmusik/pink \"0.3.0\" :exclusions [org.clojure/clojure]]\n"
                + "] :repositories (merge cemerick.pomegranate.aether/maven-central {\"clojars\" \"http://clojars.org/repo\"}))";
        result = instance.getPomegranateString();
        assertEquals(expResult, result);
    }

}
