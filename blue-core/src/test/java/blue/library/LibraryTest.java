/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.library;

import blue.soundObject.SoundObject;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class LibraryTest {
    
    public LibraryTest() {
    }

    /**
     * Test of createLibrary method, of class Library.
     */
    @Test
    public void testCreateLibrary() {
        System.out.println("createLibrary");
        Library<SoundObject> result = Library.createLibrary("SoundObjects");

        assertEquals("SoundObjects", result.getRoot().getValue().toString());
    }
    
}
