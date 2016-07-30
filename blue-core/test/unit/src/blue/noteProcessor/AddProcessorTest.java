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

import junit.framework.TestCase;

/**
 * @author steven
 */
public class AddProcessorTest extends TestCase {

    private AddProcessor addProcessor;

    /*
     * @see TestCase#setUp()
     */
    @Override
    protected void setUp() throws Exception {
        super.setUp();
        this.addProcessor = new AddProcessor();
    }

    /*
     * @see TestCase#tearDown()
     */
    @Override
    protected void tearDown() throws Exception {
        super.tearDown();
        this.addProcessor = null;
    }

    public final void testSetPfield() {
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

    public final void testSetVal() {
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

    public final void testProcessNotes() {
        // TODO Implement processNotes().
    }

    public final void testLoadFromXML() {
        // TODO Implement loadFromXML().
    }

    public final void testSaveAsXML() {
        // TODO Implement saveAsXML().
    }

}
