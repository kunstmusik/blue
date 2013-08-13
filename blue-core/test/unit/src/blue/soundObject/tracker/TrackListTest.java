/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.tracker;

import junit.framework.TestCase;

public class TrackListTest extends TestCase {

    private TrackList list;

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        list = new TrackList();
        list.addTrack(new Track());
        list.addTrack(new Track());
        list.addTrack(new Track());
    }

    public final void testGetColumnCount() {
        assertEquals(9, list.getColumnCount());
    }

    public final void testGetColumnName() {
        for (int i = 0; i < list.getColumnCount(); i++) {
            boolean success = true;
            try {
                list.getColumnName(i);
            } catch (IndexOutOfBoundsException e) {
                success = false;
            }

            assertTrue("Could not find value for index: " + i, success);
        }
    }

}
