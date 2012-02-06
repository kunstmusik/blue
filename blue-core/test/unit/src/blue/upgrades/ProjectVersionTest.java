/*
 * blue - object composition environment for csound
 * Copyright (c) 2012 Steven Yi (stevenyi@gmail.com)
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
package blue.upgrades;

import static org.junit.Assert.*;
import org.junit.*;

/**
 *
 * @author stevenyi
 */
public class ProjectVersionTest {
    
    public ProjectVersionTest() {
    }

    @BeforeClass
    public static void setUpClass() throws Exception {
    }

    @AfterClass
    public static void tearDownClass() throws Exception {
    }
    
    @Before
    public void setUp() {
    }
    
    @After
    public void tearDown() {
    }

    /**
     * Test of parseVersion method, of class ProjectVersion.
     */
    @Test
    public void testParseVersion() {
        String versionString = "0.129.2_beta";
        ProjectVersion result = ProjectVersion.parseVersion(versionString);
        assertEquals("Version: 0 129 2 BETA", result.toString());
    }
    
    @Test
    public void testParseVersion_EmptyOrNull() {
        ProjectVersion result = ProjectVersion.parseVersion("");
        assertEquals("Version: Empty", result.toString());
        result = ProjectVersion.parseVersion(null);
        assertEquals("Version: Empty", result.toString());
    }
    
    @Test
    public void testParseVersion_Illformatted() {
        ProjectVersion result = ProjectVersion.parseVersion("x.54.-345_beta_beta");
        assertEquals("Version: -1 54 -345 BETA", result.toString());
        result = ProjectVersion.parseVersion("a.b.c.d");
        assertEquals("Version: -1 -1 -1 -1", result.toString());
    }
    
    @Test
    public void testLessThan() {
        ProjectVersion version1 = ProjectVersion.parseVersion("0.0.0");
        ProjectVersion version2 = ProjectVersion.parseVersion("0.0.1");
        assertTrue(version1.lessThan(version2));
        
        version1 = ProjectVersion.parseVersion("0.1.0");
        version2 = ProjectVersion.parseVersion("0.0.0");
        assertFalse(version1.lessThan(version2));
        
        version1 = ProjectVersion.parseVersion("0.1.0");
        version2 = ProjectVersion.parseVersion("0.1.0");
        assertFalse(version1.lessThan(version2));
        
        version1 = ProjectVersion.parseVersion("0.1.0");
        version2 = ProjectVersion.parseVersion("1.1.0");
        assertTrue(version1.lessThan(version2));
        
        version1 = ProjectVersion.parseVersion("1.1.0");
        version2 = ProjectVersion.parseVersion("1.1.1");
        assertTrue(version1.lessThan(version2));
        
        version1 = ProjectVersion.parseVersion("1.1.1_beta");
        version2 = ProjectVersion.parseVersion("1.1.1");
        assertTrue(version1.lessThan(version2));
    }
}
