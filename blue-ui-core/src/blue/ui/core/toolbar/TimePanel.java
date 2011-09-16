/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2011 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.toolbar;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import javax.swing.JComponent;

/**
 *
 * @author stevenyi
 */
public class TimePanel extends JComponent {

    @Override
    public void paint(Graphics g) {
        String time1 = "00:00:00.001";
        String time2 = "00:05:03.001";
        String time3 = "02:00:40.031";

        g.setColor(Color.BLACK);
        g.fillRoundRect(0, 0, 220, 60, 10, 10);

        g.setColor(new Color(192, 225, 255, 196));

        g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 10));
        g.drawString("Start", 5, 10);
        g.drawString("End", 110, 10);

        g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 13));
        g.drawString(time1, 5, 25);
        g.drawString(time2, 110, 25);
        g.drawString(time3, 205, 25);
        
        
    }
}
