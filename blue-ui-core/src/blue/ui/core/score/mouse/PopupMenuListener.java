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

import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreTopComponent;
import static blue.ui.core.score.mouse.BlueMouseAdapter.scoreTC;
import blue.ui.utilities.UiUtilities;
import java.awt.Component;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.List;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import org.openide.util.Utilities;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
@ScoreMouseListenerPlugin(displayName = "PopupMenuListener",
        position = 10)
public class PopupMenuListener extends BlueMouseAdapter {

    @Override
    public void mousePressed(MouseEvent e) {
        if (UiUtilities.isRightMouseButton(e)) {
            showPopup(e.getComponent(), e);
            e.consume();
        }
    }

    protected static void showPopup(Component comp, MouseEvent e) {
        Collection<? extends ScoreObject> soundObjects
                = Utilities.actionsGlobalContext().lookupAll(ScoreObject.class);

        Point point = SwingUtilities.convertPoint(e.getComponent(),
                e.getPoint(), scoreTC.getLayerPanel());

        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");

        if (currentScoreObjectView != null) {
            if (soundObjects.size() > 0) {
                List<? extends Action> list = Utilities.actionsForPath(
                        "blue/score/actions");
                content.add(currentLayerGroupPanel);
                content.add(point);
                content.add(scoreTC.getTimeState());

                final JPopupMenu menu = Utilities.actionsToPopup(list.toArray(
                        new Action[0]),
                        scoreTopComponent.getLookup());
                try {
                    menu.show(scoreTopComponent.getLayerPanel(), point.x, point.y);
                } finally {
                    content.remove(scoreTC.getTimeState());
                    content.remove(point);
                    content.remove(currentLayerGroupPanel);
                }
            }
        } else if (currentLayerGroupPanel != null) {

            Action[] actions = currentLayerGroupPanel.getLayerActions();

            if (actions != null && actions.length > 0) {
                Point p = e.getPoint();
                content.add(currentLayerGroupPanel);
                content.add(point);
                content.add(scoreTC.getTimeState());
                final JPopupMenu menu = Utilities.actionsToPopup(actions,
                        scoreTopComponent.getLookup());
                try {
                    menu.show(scoreTopComponent.getLayerPanel(), point.x, point.y);
                } finally {
                    content.remove(scoreTC.getTimeState());
                    content.remove(point);
                    content.remove(currentLayerGroupPanel);
                }
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
