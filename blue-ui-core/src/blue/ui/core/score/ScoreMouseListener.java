/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.ui.core.score;

import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.layers.LayerGroupPanel;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;

/**
 *
 * @author stevenyi
 */
public class ScoreMouseListener extends MouseAdapter {

    private final ScoreTopComponent scoreTC;

    public ScoreMouseListener(ScoreTopComponent tc) {
        this.scoreTC = tc;
    }
    
    @Override
    public void mousePressed(MouseEvent e) {
        RealtimeRenderManager.getInstance().stopAuditioning();
        
        if(e.isConsumed()) {
            return;
        }
        
        Point point = SwingUtilities.convertPoint((JComponent)e.getSource(), e.getPoint(),
                scoreTC.scorePanel);
        
        scoreTC.marquee.setStart(point);
        scoreTC.marquee.setVisible(true);
    }
    
    @Override
    public void mouseDragged(MouseEvent e) {
        if(e.isConsumed()) {
            return;
        }
        Point point = SwingUtilities.convertPoint((JComponent)e.getSource(), e.getPoint(),
                scoreTC.scorePanel);
        
        scoreTC.marquee.setDragPoint(point);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        if(e.isConsumed()) {
            return;
        }
        
        scoreTC.marquee.setVisible(false);
        
        Component[] comps = scoreTC.layerPanel.getComponents();
        
        for(Component c : comps) {
            if(c instanceof LayerGroupPanel) {
                ((LayerGroupPanel)c).marqueeSelectionPerformed(scoreTC.marquee);
            }
        }
    }
    
}
