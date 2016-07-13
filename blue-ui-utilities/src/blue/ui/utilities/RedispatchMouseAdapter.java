/*
 * blue - object composition environment for csound Copyright (c) 2000-2016
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.utilities;

import java.awt.AWTEvent;
import java.awt.Component;
import java.awt.Container;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseWheelEvent;

/**
 * MouseAdapter that, by default, redispatches events to its source's parent.
 * Useful for creating mouse listeners that may want to intercept and operate
 * on a mouse event for a given condition, but otherwise pass handling back up 
 * the hierarchy.
 * 
 * @author stevenyi
 */


public class RedispatchMouseAdapter extends MouseAdapter {
        
    protected void redispatchEvent(AWTEvent e) {
        if(e.getSource() instanceof Component) {
            Container c = ((Component)e.getSource()).getParent();
            if(c != null) {
                c.dispatchEvent(e);
            }
        }
    }
    
    @Override
    public void mouseMoved(MouseEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mouseWheelMoved(MouseWheelEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mouseExited(MouseEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mouseEntered(MouseEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mousePressed(MouseEvent e) {
        redispatchEvent(e);
    }

    @Override
    public void mouseClicked(MouseEvent e) {
        redispatchEvent(e);
    }
    
}
