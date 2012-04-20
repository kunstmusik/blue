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
package blue.soundObject;

import blue.soundObject.pattern.Pattern;
import junit.framework.TestCase;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class PatternObjectTest extends TestCase {
    public void testClone() {
        PatternObject p = new PatternObject();
        p.addPattern(0);
        p.addPattern(0);
        p.addPattern(0);

        for (int i = 0; i < p.size(); i++) {
            Pattern pat = p.getPattern(i);

            for (int j = 0; j < pat.values.length; j++) {
                pat.values[j] = (Math.random() > 0.5d);
            }
        }

        SoundObject clone = (SoundObject) p.clone();

        boolean isEqual = EqualsBuilder.reflectionEquals(p, clone);

        if (!isEqual) {
            StringBuilder buffer = new StringBuilder();
            buffer.append("Problem with Pattern\n");
            buffer.append("Original Object\n");
            buffer.append(ToStringBuilder.reflectionToString(p)).append("\n");
            buffer.append("Cloned Object\n");
            buffer.append(ToStringBuilder.reflectionToString(clone)).append(
                    "\n");

            System.out.println(buffer.toString());

        }

        assertTrue(isEqual);

        assertEquals(p.saveAsXML(null).toString(), clone.saveAsXML(null)
                .toString());
    }
}
