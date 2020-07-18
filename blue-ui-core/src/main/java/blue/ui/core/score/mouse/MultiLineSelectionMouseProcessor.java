/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2008 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.ui.core.score.mouse;

import blue.ui.core.score.layers.soundObject.views.SoundObjectView;
import blue.ui.core.score.layers.soundObject.*;
import blue.components.AlphaMarquee;
import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.MultiLineScoreSelection;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.layers.LayerGroupPanel;
import static blue.ui.core.score.mouse.BlueMouseAdapter.scoreTC;
import blue.ui.utilities.ResizeMode;
import blue.ui.utilities.UiUtilities;
import blue.utility.ScoreUtilities;
import java.awt.Component;
import java.awt.KeyboardFocusManager;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseEvent;
import java.util.List;
import javax.swing.SwingUtilities;

@ScoreMouseListenerPlugin(displayName = "MultiLineSelectionMouseProcessor",
        position = 100)
class MultiLineSelectionMouseProcessor extends BlueMouseAdapter {

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    Layer startLayer = null;
    Layer lastLayer = null;
    List<Layer> allLayers = null;
    int startX = -1;
    int[] startTopBottom = null;

    TimeState timeState = null;

    MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();

    boolean isShiftDown = false;

    public MultiLineSelectionMouseProcessor() {
        KeyboardFocusManager.getCurrentKeyboardFocusManager().addKeyEventDispatcher(key -> {
            isShiftDown = key.isShiftDown();
            return false;
        });
    }

    @Override
    public void mousePressed(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        AlphaMarquee marquee = scoreTC.getMarquee();
        Point p = SwingUtilities.convertPoint(scoreTC.getScorePanel(),
                e.getPoint(), marquee);

        var resizeMode = UiUtilities.getResizeMode(e.getComponent(), e.getPoint(), marquee);
        
        if (marquee.isVisible() && (marquee.contains(p) || 
                resizeMode != ResizeMode.NONE)) {
            return;
        }

        e.consume();
        RealtimeRenderManager.getInstance().stopAuditioning();

        ScoreController.getInstance().setSelectedScoreObjects(null);
        selection.reset();

        SoundObjectView sObjView;

        ScorePath scorePath = ScoreController.getInstance().getScorePath();

        Layer layer = scorePath.getGlobalLayerForY(e.getY());

        if (layer == null || !(layer instanceof ScoreObjectLayer)) {
            return;
        }

        startLayer = lastLayer = layer;
        allLayers = scorePath.getAllLayers();

        if (SwingUtilities.isLeftMouseButton(e)) {
            startX = Math.max(e.getX(), 0);
            timeState = scoreTC.getTimeState();

            double startTime = startX / (double) timeState.getPixelSecond();
            if (timeState.isSnapEnabled()) {
                startTime = ScoreUtilities.getSnapValueStart(startTime,
                        timeState.getSnapValue());
                startX = (int) (startTime * timeState.getPixelSecond());
            }

            startTopBottom = ScorePath.getTopBottomForLayer(layer,
                    scorePath.getScore());

        }
    }

    @Override
    public void mouseDragged(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        e.consume();

        AlphaMarquee marquee = scoreTC.getMarquee();

        if (SwingUtilities.isLeftMouseButton(e)) {
            int x = Math.max(e.getX(), 0);
            double mouseDragTime = x / (double) timeState.getPixelSecond();

            if (timeState.isSnapEnabled()) {
                mouseDragTime = ScoreUtilities.getSnapValueMove(mouseDragTime,
                        timeState.getSnapValue());
                x = (int) (mouseDragTime * timeState.getPixelSecond());
            }

            ScorePath scorePath = ScoreController.getInstance().getScorePath();

            Layer layer = scorePath.getGlobalLayerForY(e.getY());

            if (layer != null && (layer instanceof ScoreObjectLayer)) {
                lastLayer = layer;
            }

//            if (!(layer instanceof ScoreObjectLayer)) {
//                return;
//            }
            int[] topBottom = ScorePath.getTopBottomForLayer(lastLayer,
                    scorePath.getScore());

            int leftX, rightX;
            int startLayerIndex, endLayerIndex;

            if (x < startX) {
                leftX = x;
                rightX = startX;
            } else {
                leftX = startX;
                rightX = x;
            }

            if (topBottom[0] < startTopBottom[0]) {
                startLayerIndex = allLayers.indexOf(lastLayer);
                endLayerIndex = allLayers.indexOf(startLayer);
            } else {
                startLayerIndex = allLayers.indexOf(startLayer);
                endLayerIndex = allLayers.indexOf(lastLayer);
            }

            leftX = Math.max(leftX, 0);

            double start = leftX / (double) timeState.getPixelSecond();
            double end = rightX / (double) timeState.getPixelSecond();

            marquee.startTime = start;
            marquee.endTime = end;

            List<Layer> currentLayers = allLayers.subList(startLayerIndex,
                    endLayerIndex + 1);

            selection.updateSelection(start, end, currentLayers);
        }

        checkScroll(e);

    }

    @Override
    public void mouseReleased(MouseEvent e) {
        if (!isMultiLineMode()) {
            return;
        }

        e.consume();

        // FIXME: Not sure this is the best place to check for isShiftDown as 
        // it short circuits calling to marqueeSelectionPerformed, which might
        // be of use in later non-ScoreObject layers.
        if (timeState != null && isShiftDown) {
            ScoreController.getInstance().setSelectedScoreObjects(null);

            if (SwingUtilities.isLeftMouseButton(e)) {
                Component[] comps = scoreTC.getLayerPanel().getComponents();

                for (Component c : comps) {
                    if (c instanceof LayerGroupPanel) {
                        ((LayerGroupPanel) c).marqueeSelectionPerformed(
                                scoreTC.getMarquee());
                    }
                }
            }
            timeState = null;
        }
    }

    private boolean isMultiLineMode() {
        return ModeManager.getInstance().getMode() == ScoreMode.MULTI_LINE;
    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.MULTI_LINE;
    }
}
