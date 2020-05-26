/*
 * blue - object composition environment for csound
 * Copyright (c) 2010 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.utilities;

import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseEvent;
import javax.swing.SwingUtilities;

/**
 *
 * @author stevenyi
 */
public class UiUtilities {

    
    public static final int EDGE = 5;

    public static boolean isRightMouseButton(MouseEvent e) {
        return SwingUtilities.isRightMouseButton(e) && !SwingUtilities.isLeftMouseButton(e);
    }

    /**
     * Calculate if left/right resize should occur according to to point, component, and
     * EDGE
     */
    public static ResizeMode getResizeMode(Component source, Point point, Component target) {
        Point p = SwingUtilities.convertPoint(source,
                point,
                target);

        if (p.x > 0 && p.x < EDGE) {
            return ResizeMode.LEFT;
        } else if (p.x > target.getWidth() - EDGE && p.x < target.getWidth()) {
            return ResizeMode.RIGHT;
        } else {
            return ResizeMode.NONE;
        }
    }
    
    public static void invokeOnSwingThread(Runnable r) {
        if(SwingUtilities.isEventDispatchThread()) {
            r.run();
        } else {
            SwingUtilities.invokeLater(r);
        }
    }
}
