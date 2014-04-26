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
import java.awt.Cursor;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.Arrays;
import java.util.List;
import javax.swing.JComponent;
import javax.swing.JLayeredPane;
import javax.swing.SwingUtilities;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class ScoreMouseListener extends MouseAdapter {

    private static final int EDGE = 5;
    private final Cursor LEFT_RESIZE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.W_RESIZE_CURSOR);
    private final Cursor RIGHT_RESIZE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.E_RESIZE_CURSOR);
    private final Cursor NORMAL_CURSOR = Cursor
            .getPredefinedCursor(Cursor.DEFAULT_CURSOR);
    private final ScoreTopComponent scoreTC;
    private MouseAdapter currentGestureListener = null;
    private MouseAdapter[] mouseListeners;

    public ScoreMouseListener(ScoreTopComponent tc, InstanceContent content) {
        this.scoreTC = tc;
        BlueMouseAdapter.scoreTC = tc;
        BlueMouseAdapter.content = content;

        FileObject sObjFiles[] = FileUtil.getConfigFile(
                "blue/score/mouse").getChildren();
        List<FileObject> orderedSObjFiles = FileUtil.getOrder(
                Arrays.asList(sObjFiles), true);

        mouseListeners = new BlueMouseAdapter[sObjFiles.length];

        for (int i = 0; i < orderedSObjFiles.size(); i++) {
            FileObject fObj = orderedSObjFiles.get(i);
            BlueMouseAdapter mouseListener = FileUtil.getConfigObject(
                    fObj.getPath(),
                    BlueMouseAdapter.class);
            mouseListeners[i] = mouseListener;
        }
    }

    @Override
    public void mousePressed(MouseEvent e
    ) {
        RealtimeRenderManager.getInstance().stopAuditioning();

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

        for (int i = 0; i < mouseListeners.length && !e.isConsumed(); i++) {
            current = mouseListeners[i];
            current.mousePressed(e);

//            if(e.isConsumed()) {
//                System.out.println("Current: " + current);
//            }
        }

        currentGestureListener = e.isConsumed() ? current : null;

    }

    @Override
    public void mouseDragged(MouseEvent e
    ) {
        if (e.isConsumed() || currentGestureListener == null) {
            return;
        }
        currentGestureListener.mouseDragged(e);
    }

    @Override
    public void mouseReleased(MouseEvent e
    ) {

        if (!e.isConsumed() && currentGestureListener != null) {
            currentGestureListener.mouseReleased(e);
        }

        currentGestureListener = null;
        BlueMouseAdapter.content.remove(
                ScoreController.getInstance().getScorePath());
    }

    @Override
    public void mouseMoved(MouseEvent e
    ) {
        if (ModeManager.getInstance().getMode() != ModeManager.MODE_SCORE) {
            return;
        }

        ScoreObjectView sObjView = scoreTC.getScoreObjectViewAtPoint(e);

        final JLayeredPane scorePanel = scoreTC.getScorePanel();

        // FIXME - perhaps optimize the lookup to cache results using lookup listener
        if (sObjView != null
                && scoreTC.getLookup().lookupAll(ScoreObject.class).contains(
                        sObjView.getScoreObject())) {

            Point p = SwingUtilities.convertPoint(e.getComponent(),
                    e.getPoint(),
                    (JComponent) sObjView);
            JComponent comp = (JComponent) sObjView;

            if (p.x > 0 && p.x < EDGE) {
                scorePanel.setCursor(RIGHT_RESIZE_CURSOR);
            } else if (p.x > comp.getWidth() - EDGE && p.x <= comp.getWidth()) {
                scorePanel.setCursor(LEFT_RESIZE_CURSOR);
            } else {
                scorePanel.setCursor(NORMAL_CURSOR);
            }
        } else {
            scorePanel.setCursor(NORMAL_CURSOR);
        }

    }
}
