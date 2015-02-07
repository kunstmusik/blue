/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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
package blue.ui.core.score;

import blue.BlueSystem;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import javax.swing.SwingUtilities;

/**
 *
 * @author syi
 */
public class LayerHeightWheelListener implements MouseWheelListener {

    MouseWheelListener[] listeners;
    private final Component source;

    public LayerHeightWheelListener(Component source) {
        this.source = source;
    }

    @Override
    public void mouseWheelMoved(MouseWheelEvent e) {

        int shortcutKey = BlueSystem.getMenuShortcutKey();
        
        if ((e.getModifiers() & shortcutKey) == shortcutKey) {

            int value = e.getWheelRotation();

            value = (value > 0) ? 1 : -1;
            Point p = SwingUtilities.convertPoint(e.getComponent(), e.getPoint(), source);
            
            Layer layer = ScoreController.getInstance().getScorePath().getGlobalLayerForY(
                    p.y);

            if(layer instanceof ScoreObjectLayer) {
                ScoreObjectLayer sLayer = (ScoreObjectLayer)layer;
                int index = sLayer.getHeightIndex();
                int newIndex = index + value;
    
                if(newIndex >= 0 && newIndex <= ScoreObjectLayer.HEIGHT_MAX_INDEX) {
                    sLayer.setHeightIndex(newIndex);
                }

                e.consume();
            }
            
        } else {
           source.getParent().dispatchEvent(e);
        }
    }
}