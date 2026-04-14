/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.noteProcessor;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * @author steven
 */
class AddProcessorTest {

    private AddProcessor addProcessor;

    /*
     * @see TestCase#setUp()
     */
    @BeforeEach
    void setUp() throws Exception {
        this.addProcessor = new AddProcessor();
    }

    /*
     * @see TestCase#tearDown()
     */
    @AfterEach
    void tearDown() throws Exception {
        this.addProcessor = null;
    }

    @Test
    void testSetPfield() {
        String value = "4";
        this.addProcessor.setPfield(value);

        assertEquals(this.addProcessor.getPfield(), value);

        value = "not a number";
        try {
            this.addProcessor.setPfield(value);
            fail("Should raise an NumberFormatException");
        } catch (NumberFormatException nfe) {
            assertTrue(true);
        }

        value = "4.1";
        try {
            this.addProcessor.setPfield(value);
            fail("Should raise an NumberFormatException");
        } catch (NumberFormatException nfe) {
            assertTrue(true);
        }

    }

    @Test
    void testSetVal() {
        String value = "4.1";
        this.addProcessor.setVal(value);

        assertEquals(this.addProcessor.getVal(), value);

        value = "not a number";
        try {
            this.addProcessor.setVal(value);
            fail("Should raise an NumberFormatException");
        } catch (NumberFormatException nfe) {
            assertTrue(true);
        }

        value = "4";
        this.addProcessor.setVal(value);

        assertEquals(this.addProcessor.getVal(), "4.0");

    }

    @Test
    void testProcessNotes() {
        // TODO Implement processNotes().
    }

    @Test
    void testLoadFromXML() {
        // TODO Implement loadFromXML().
    }

    @Test
    void testSaveAsXML() {
        // TODO Implement saveAsXML().
    }

}
