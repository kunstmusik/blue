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

import blue.score.ScoreObject;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.mouse.BlueMouseAdapter;
import blue.ui.nbutilities.lazyplugin.LazyPlugin;
import blue.ui.nbutilities.lazyplugin.LazyPluginFactory;
import blue.ui.utilities.UiUtilities;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.List;
import java.util.logging.Logger;
import javax.swing.JComponent;
import javax.swing.JLayeredPane;
import javax.swing.SwingUtilities;
import org.openide.util.lookup.InstanceContent;

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
    private final Cursor MOVE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.MOVE_CURSOR);
    private final ScoreTopComponent scoreTC;
    private MouseAdapter currentGestureListener = null;
    private final BlueMouseAdapter[] mouseListeners;

    public ScoreMouseListener(ScoreTopComponent tc, InstanceContent content) {
        this.scoreTC = tc;
        BlueMouseAdapter.scoreTC = tc;
        BlueMouseAdapter.content = content;

        List<LazyPlugin<BlueMouseAdapter>> plugins = LazyPluginFactory.loadPlugins(
                "blue/score/mouse", BlueMouseAdapter.class);

        mouseListeners = new BlueMouseAdapter[plugins.size()];

        for (int i = 0; i < plugins.size(); i++) {
            mouseListeners[i] = plugins.get(i).getInstance();
        }
    }

    @Override
    public void mousePressed(MouseEvent e) {
        RealtimeRenderManager.getInstance().stopAuditioning();

        scoreTC.getScorePanel().requestFocus();

        if (e.isConsumed()) {
            return;
        }

        LayerGroupPanel lGroupPanel = scoreTC.getLayerGroupPanelAtPoint(e);
        ScoreObjectView scoreObjView = null;

        if (lGroupPanel != null) {
            scoreObjView = lGroupPanel.getScoreObjectViewAtPoint(
                    SwingUtilities.convertPoint(e.getComponent(),
                            e.getPoint(),
                            (JComponent) lGroupPanel));
        }

        BlueMouseAdapter.currentLayerGroupPanel = lGroupPanel;
        BlueMouseAdapter.currentScoreObjectView = scoreObjView;

        BlueMouseAdapter.content.add(
                ScoreController.getInstance().getScorePath());

        MouseAdapter current = null;
        ScoreMode mode = ModeManager.getInstance().getMode();

        try {
            for (int i = 0; i < mouseListeners.length && !e.isConsumed(); i++) {
                if (mouseListeners[i].acceptsMode(mode)) {
                    current = mouseListeners[i];
                    current.mousePressed(e);
                }
            }
            currentGestureListener = e.isConsumed() ? current : null;
        } catch (Exception ex) {
            Logger.getLogger("ScoreMouseListener").
                    severe("Mouse Press threw exception: " + ex.getMessage());
            currentGestureListener = null;
        }

    }

    @Override
    public void mouseDragged(MouseEvent e
    ) {
        if (e.isConsumed() || currentGestureListener == null) {
            return;
        }
        try {
            currentGestureListener.mouseDragged(e);
        } catch (Exception ex) {
            Logger.getLogger("ScoreMouseListener").
                    severe("Mouse Dragged threw exception: " + ex.getMessage());
            currentGestureListener = null;
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) {

        if (!e.isConsumed() && currentGestureListener != null) {
            try {
                currentGestureListener.mouseReleased(e);
            } catch (Exception ex) {
                Logger.getLogger("ScoreMouseListener").
                        severe("Mouse Released threw exception: " + ex.getMessage());
                currentGestureListener = null;
            }
        }

        currentGestureListener = null;
        BlueMouseAdapter.content.remove(
                ScoreController.getInstance().getScorePath());
    }

    @Override
    public void mouseMoved(MouseEvent e
    ) {
        if (e.isConsumed()) {
            final JLayeredPane scorePanel = scoreTC.getScorePanel();

            if (scorePanel.getCursor() != NORMAL_CURSOR) {
                scorePanel.setCursor(NORMAL_CURSOR);
            }
            return;
        }
        switch (ModeManager.getInstance().getMode()) {
            case SCORE:
                handleMouseMovedModeScore(e);
                break;
            case SINGLE_LINE:
                break;
            case MULTI_LINE:
                handleMouseMovedModeMultiLine(e);
                break;
        }

    }

    private void handleMouseMovedModeMultiLine(MouseEvent e) {
        final var scorePanel = scoreTC.getScorePanel();

        final var marquee = scoreTC.getMarquee();

        var resizeMode = UiUtilities.getResizeMode(e.getComponent(), e.getPoint(), marquee);

        switch (resizeMode) {
            case LEFT:
                scorePanel.setCursor(RIGHT_RESIZE_CURSOR);
                break;
            case RIGHT:
                scorePanel.setCursor(LEFT_RESIZE_CURSOR);
                break;
            default:
                if (scorePanel.getCursor() != NORMAL_CURSOR) {
                    scorePanel.setCursor(NORMAL_CURSOR);
                }
                break;
        }
    }

    private void handleMouseMovedModeScore(MouseEvent e) {
        ScoreObjectView sObjView = scoreTC.getScoreObjectViewAtPoint(e);

        final JLayeredPane scorePanel = scoreTC.getScorePanel();

        Collection<? extends ScoreObject> selectedObjects
                = scoreTC.getLookup().lookupAll(ScoreObject.class);

        // FIXME - perhaps optimize the lookup to cache results using lookup listener
        if (sObjView != null
                && selectedObjects.size() >= 1
                && selectedObjects.contains(
                        sObjView.getScoreObject())) {

            blue.ui.utilities.ResizeMode resizeMode = UiUtilities.getResizeMode(e.getComponent(), e.getPoint(), (Component) sObjView);

            switch (resizeMode) {
                case LEFT:
                    scorePanel.setCursor(RIGHT_RESIZE_CURSOR);
                    break;
                case RIGHT:
                    scorePanel.setCursor(LEFT_RESIZE_CURSOR);
                    break;
                default:
                    scorePanel.setCursor(MOVE_CURSOR);

                    break;
            }
        } else {
            if (scorePanel.getCursor() != NORMAL_CURSOR) {
                scorePanel.setCursor(NORMAL_CURSOR);
            }
        }
    }
}
