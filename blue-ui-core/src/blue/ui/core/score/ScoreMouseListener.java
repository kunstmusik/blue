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
import blue.ui.core.score.mouse.BlueMouseAdapter;
import blue.ui.core.score.mouse.MarqueeSelectionListener;
import blue.ui.core.score.mouse.PopupMenuListener;
import blue.ui.utilities.UiUtilities;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;

/**
 *
 * @author stevenyi
 */
public class ScoreMouseListener extends MouseAdapter {

    private final Cursor LEFT_RESIZE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.W_RESIZE_CURSOR);
    private final Cursor RIGHT_RESIZE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.E_RESIZE_CURSOR);
    private final Cursor NORMAL_CURSOR = Cursor
            .getPredefinedCursor(Cursor.DEFAULT_CURSOR);

    private final ScoreTopComponent scoreTC;
    private MouseAdapter currentGestureListener = null;

    private MouseAdapter[] mouseListeners = {
        new PopupMenuListener(), new MarqueeSelectionListener()
    };

    public ScoreMouseListener(ScoreTopComponent tc) {
        this.scoreTC = tc;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        RealtimeRenderManager.getInstance().stopAuditioning();

        if (e.isConsumed()) {
            return;
        } 
        
        LayerGroupPanel lGroupPanel = scoreTC.getLayerGroupPanelAtPoint(e);
        ScoreObjectView scoreObjView = null;

        if (lGroupPanel != null) {
            scoreObjView = lGroupPanel.getScoreObjectViewAtPoint(
                    SwingUtilities.convertPoint(e.getComponent(), e.getPoint(),
                    (JComponent) lGroupPanel));
        }

        BlueMouseAdapter.currentLayerGroupPanel = lGroupPanel;
        BlueMouseAdapter.currentScoreObjectView = scoreObjView;
    
        MouseAdapter current = null;
        
        for(int i = 0; i < mouseListeners.length && !e.isConsumed(); i++) {
            current = mouseListeners[i];
            current.mousePressed(e);
        }

        currentGestureListener = e.isConsumed() ? current : null;
        
        
//        if (UiUtilities.isRightMouseButton(e)) {
//            ScorePopup.showPopup(e.getComponent(), e);
//
//        } else {
//
//            
//            
//            Point point = SwingUtilities.convertPoint((JComponent) e.getSource(),
//                    e.getPoint(),
//                    scoreTC.scorePanel);
//
//            scoreTC.marquee.setStart(point);
//            scoreTC.marquee.setVisible(true);
//        }

    }

    @Override
    public void mouseDragged(MouseEvent e) {
        if (e.isConsumed() || currentGestureListener == null) {
            return;
        }
        currentGestureListener.mouseDragged(e);
//        Point point = SwingUtilities.convertPoint((JComponent) e.getSource(),
//                e.getPoint(),
//                scoreTC.scorePanel);
//
//        scoreTC.marquee.setDragPoint(point);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        if (e.isConsumed() || currentGestureListener == null) {
            return;
        }

        currentGestureListener.mouseReleased(e);
        currentGestureListener = null;
        
        
//        scoreTC.marquee.setVisible(false);
//
//        Component[] comps = scoreTC.layerPanel.getComponents();
//
//        for (Component c : comps) {
//            if (c instanceof LayerGroupPanel) {
//                ((LayerGroupPanel) c).marqueeSelectionPerformed(scoreTC.marquee);
//            }
//        }
    }

    @Override
    public void mouseMoved(MouseEvent e) {
//        if (!isScoreMode()) {
//            return;
//        }
//        System.out.println(e.getComponent().getComponentAt(e.getPoint()));   
//        Component comp = sCanvas.getSoundObjectPanel().getComponentAt(
//                e.getPoint());
//        if (comp instanceof SoundObjectView) {
//            if (e.getX() > (comp.getX() + comp.getWidth() - EDGE)) {
//                sCanvas.setCursor(RIGHT_RESIZE_CURSOR);
//                dragMode = RESIZE_RIGHT;
//            } else if (e.getX() < (comp.getX() + EDGE)) {
//                sCanvas.setCursor(LEFT_RESIZE_CURSOR);
//                dragMode = RESIZE_LEFT;
//            } else {
//                sCanvas.setCursor(NORMAL_CURSOR);
//                dragMode = MOVE;
//            }
//        } else {
//            sCanvas.setCursor(NORMAL_CURSOR);
//            dragMode = MOVE;
//        }
    }
}
