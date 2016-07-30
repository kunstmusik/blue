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
package blue.mixer;

import blue.automation.Parameter;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import junit.framework.TestCase;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class MixerTest extends TestCase {
    
    public void testSaveParam() {
        Parameter p = new Parameter();
        Parameter clone = (Parameter) ObjectUtilities.clone(p);
        assertEquals(p, clone);
    }
    
    public void testSave() {

        Mixer mixer = new Mixer();

        for (int i = 0; i < 3; i++) {
            Channel channel = new Channel();
            channel.setName(Integer.toString(i + 1));
            mixer.getChannels().add(channel);
        }

        for (int i = 0; i < 3; i++) {
            Channel channel = new Channel();
            channel.setName("SubChannel" + i);
            mixer.getSubChannels().add(channel);
        }

        Mixer clone = (Mixer) ObjectUtilities.clone(mixer);

        boolean isEqual = mixer.equals(clone);

        if (!isEqual) {
            StringBuilder buffer = new StringBuilder();
            buffer.append("Problem with Mixer\n");
            buffer.append("Original Object\n");
            buffer.append(ToStringBuilder.reflectionToString(mixer)).append("\n");
            buffer.append("Cloned Object\n");
            buffer.append(ToStringBuilder.reflectionToString(clone)).append("\n");

            System.out.println(buffer.toString());

        }

        assertTrue(isEqual);

        Element elem1 = mixer.saveAsXML();

        Element elem2 = (clone).saveAsXML();

        assertEquals(elem1.getTextString(), elem2.getTextString());

    }
}
