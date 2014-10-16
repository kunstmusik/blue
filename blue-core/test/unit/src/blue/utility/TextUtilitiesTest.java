/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.utility;

import java.util.HashMap;
import junit.framework.TestCase;

public class TextUtilitiesTest extends TestCase {
    public final void testReplaceOpcodeNames() {
        HashMap map = new HashMap();
        map.put("test1", "uniqueUDO1");

        // normal replacement
        String testVal = "val test1 val";

        assertEquals("val uniqueUDO1 val", TextUtilities.replaceOpcodeNames(
                map, testVal));

        // when value is on end
        testVal = "val test11 val";

        assertEquals(testVal, TextUtilities.replaceOpcodeNames(map, testVal));

        // when value is on beginning
        testVal = "valtest1 val";

        assertEquals(testVal, TextUtilities.replaceOpcodeNames(map, testVal));

        // when key is at beginning
        testVal = "test1 val";

        assertEquals("uniqueUDO1 val", TextUtilities.replaceOpcodeNames(map,
                testVal));

        // when key is at end
        testVal = "val test1";

        assertEquals("val uniqueUDO1", TextUtilities.replaceOpcodeNames(map,
                testVal));
    }

    public void testStripSingleLineComments() {
        String testVal = "i1 2 3 4 \"test\"";
        String testVal2 = "i1 2 3 4 \"tes/t\"";

        String testBase = "i1 2 3 4 5";
        String testComm1 = testBase + "// test";
        String testComm2 = testBase + "; test";

        assertEquals(testVal, TextUtilities.stripSingleLineComments(testVal));

        assertEquals(testVal2, TextUtilities.stripSingleLineComments(testVal2));

        assertEquals(testBase, TextUtilities.stripSingleLineComments(testComm1));

        assertEquals(testBase, TextUtilities.stripSingleLineComments(testComm2));

    }
}
