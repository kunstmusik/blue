/*
 * TextAreaBorder.java
 * :tabSize=8:indentSize=8:noTabs=false:
 * :folding=explicit:collapseFolds=1:
 *
 * Copyright (C) 2004 Slava Pestov
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or any later version.
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

package org.syntax.jedit;

import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;

import javax.swing.border.AbstractBorder;
import javax.swing.plaf.metal.MetalLookAndFeel;

public class TextAreaBorder extends AbstractBorder {
    // {{{ paintBorder() method
    public void paintBorder(Component c, Graphics g, int x, int y, int width,
            int height) {
        g.translate(x, y);

        g.setColor(MetalLookAndFeel.getControlDarkShadow());
        g.drawRect(0, 0, width - 2, height - 2);

        g.setColor(MetalLookAndFeel.getControlHighlight());
        g.drawLine(width - 1, 1, width - 1, height - 1);
        g.drawLine(1, height - 1, width - 1, height - 1);

        g.setColor(MetalLookAndFeel.getControl());
        g.drawLine(width - 2, 2, width - 2, 2);
        g.drawLine(1, height - 2, 1, height - 2);

        g.translate(-x, -y);
    } // }}}

    // {{{ getBorderInsets() method
    public Insets getBorderInsets(Component c) {
        return new Insets(1, 1, 2, 2);
    } // }}}
}
