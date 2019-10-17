/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
 * Steven Yi <stevenyi@gmail.com>
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
package blue.ui.utilities;

import java.awt.Component;
import java.awt.Container;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseWheelEvent;
import javax.swing.SwingUtilities;

/**
 * Dispatches MouseEvent's a Component's parent. Useful if a the component has
 * some mouse listeners itself that may be used or not, and if not, to bubble
 * up events up the component tree hierarchy.
 * 
 * @author stevenyi
 */
public class ParentDispatchingMouseAdapter extends MouseAdapter {
    private Component source;

    public ParentDispatchingMouseAdapter(Component source) {
        this.source = source;
    }
    
    private void dispatchToParent(MouseEvent e) {
        if (!e.isConsumed()) {
            Container parentComp = source.getParent();
            if (parentComp != null) {
                parentComp.dispatchEvent(
                        SwingUtilities.convertMouseEvent(
                                (Component) e.getSource(), e,
                                parentComp));
            }
        }
    }

    @Override
    public void mousePressed(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseMoved(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseExited(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseEntered(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseClicked(MouseEvent e) {
        dispatchToParent(e);
    }

    @Override
    public void mouseWheelMoved(MouseWheelEvent e) {
        dispatchToParent(e);
    }

}
