/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.ui.core.score.mouse;

import blue.ui.core.score.layers.LayerGroupPanel;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Collections;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;

/**
 *
 * @author stevenyi
 */
public class MarqueeSelectionListener extends BlueMouseAdapter {

    boolean addMode = false; 

    @Override
    public void mousePressed(MouseEvent e) {
        e.consume();

        addMode = e.isShiftDown();
        
        if(!addMode) {
            content.set(Collections.emptyList(), null);
        }
        

        Point point = SwingUtilities.convertPoint((JComponent) e.getSource(),
                e.getPoint(),
                scoreTC.getScorePanel());

        scoreTC.getMarquee().setStart(point);
        scoreTC.getMarquee().setVisible(true);
    }

    @Override
    public void mouseDragged(MouseEvent e) {

        Point point = SwingUtilities.convertPoint((JComponent) e.getSource(),
                e.getPoint(),
                scoreTC.getScorePanel());

        scoreTC.getMarquee().setDragPoint(point);
        e.consume();
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        scoreTC.getMarquee().setVisible(false);

        Component[] comps = scoreTC.getLayerPanel().getComponents();

        for (Component c : comps) {
            if (c instanceof LayerGroupPanel) {
                ((LayerGroupPanel) c).marqueeSelectionPerformed(
                        scoreTC.getMarquee());
            }
        }
        e.consume();
    }
}
