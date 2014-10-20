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
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.mixer;

import junit.framework.TestCase;

public class EffectsChainTest extends TestCase {

    public final void testGetSends() {
        EffectsChain chain = new EffectsChain();

        Send send1 = new Send();
        Send send2 = new Send();

        chain.addEffect(new Effect());
        chain.addSend(send1);
        chain.addEffect(new Effect());
        chain.addSend(send2);
        chain.addEffect(new Effect());

        assertEquals(send1, chain.getElementAt(1));
        assertEquals(send2, chain.getElementAt(3));

        Send[] sends = chain.getSends();

        assertEquals(2, sends.length);
        assertEquals(send1, sends[0]);
        assertEquals(send2, sends[1]);
    }

}
