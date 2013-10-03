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

import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.utilities.UiUtilities;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.List;
import javax.swing.Action;
import javax.swing.JPopupMenu;
import org.openide.util.Utilities;

/**
 *
 * @author stevenyi
 */
public class PopupMenuListener extends BlueMouseAdapter {

    @Override
    public void mousePressed(MouseEvent e) {
        if (UiUtilities.isRightMouseButton(e)) {
            showPopup(e.getComponent(), e);
            e.consume();
        }
    }


    protected static void showPopup(Component comp, MouseEvent e) {
        Collection<? extends SoundObject> soundObjects =
                Utilities.actionsGlobalContext().lookupAll(SoundObject.class);
        if (currentScoreObjectView != null) {
//            if (soundObjects.contains(((SoundObjectView) comp).getSoundObject())) {
//                sCanvas.showSoundObjectPopup((SoundObjectView) comp, e.getX(),
//                        e.getY());

                List<? extends Action> list = Utilities.actionsForPath(
                        "blue/score/actions");
                final JPopupMenu menu = Utilities.actionsToPopup(list.toArray(
                        new Action[0]),
                        ScoreTopComponent.findInstance().getLookup());
                menu.show(comp.getParent(), e.getX(), e.getY());
//            }

        } else if(currentLayerGroupPanel != null) {

            Action[] actions = currentLayerGroupPanel.getLayerActions();

            if(actions != null && actions.length > 0) {
                Point p = e.getPoint();
                content.add(currentLayerGroupPanel);
                content.add(p);
                final JPopupMenu menu = Utilities.actionsToPopup(actions, 
                        ScoreTopComponent.findInstance().getLookup());
                menu.show(comp.getParent(), e.getX(), e.getY());
                content.remove(p);
                content.remove(currentLayerGroupPanel);
            }
            
//        } else if (e.getY() < sCanvas.pObj.getTotalHeight()) {
//            sCanvas.showSoundLayerPopup(getSoundLayerIndex(e.getY()), e.getX(),
//                    e.getY());
//        }
//        isPopupOpen = true;

//        this.justSelected = true;
        }
    }
    
}
