/*
 * blue - object composition environment for csound
 * Copyright (C) 2026
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License or (at your option) any later version.
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
package blue.ui.core.time;

import blue.time.TimeBase;
import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class SoundObjectTimePanelTest {

    @Test
    void testConstructorCanRestrictAvailableTimeBases() {
        SoundObjectTimePanel panel = new SoundObjectTimePanel(
                TimeBase.BEATS, TimeBase.BBT, TimeBase.BBST, TimeBase.BBF);

        TimeBaseSelector selector = (TimeBaseSelector) panel.getComponent(0);

        assertEquals(4, selector.getItemCount());
        assertEquals(TimeBase.BEATS, selector.getItemAt(0));
        assertEquals(TimeBase.BBT, selector.getItemAt(1));
        assertEquals(TimeBase.BBST, selector.getItemAt(2));
        assertEquals(TimeBase.BBF, selector.getItemAt(3));
    }
}
