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

import blue.components.AlphaMarquee;
import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.MultiLineScoreSelection;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseEvent;
import java.util.Collection;
import javax.swing.SwingUtilities;

@ScoreMouseListenerPlugin(displayName = "MultiLineSelectionMouseProcessor",
        position = 110)
class MultiLineMoveMouseListener extends BlueMouseAdapter {

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    int startX = -1;
    double minTranslation = 0.0f;
    private ScoreObject[] selectedScoreObjects = null;
    private double[] startTimes = null;

    TimeState timeState = null;

    MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();

    @Override
    public void mousePressed(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        AlphaMarquee marquee = scoreTC.getMarquee();
        Point p = SwingUtilities.convertPoint(scoreTC.getScorePanel(),
                e.getPoint(), marquee);

        if (!marquee.isVisible() || !marquee.contains(p)) {
            return;
        }

        e.consume();
        RealtimeRenderManager.getInstance().stopAuditioning();
        timeState = scoreTC.getTimeState();

        startX = e.getX();
        minTranslation = -selection.getStartTime();

        Collection<? extends ScoreObject> selectedObjects
                = ScoreController.getInstance().getSelectedScoreObjects();

        selectedScoreObjects = selectedObjects.toArray(new ScoreObject[0]);
        startTimes = new double[selectedScoreObjects.length];
        for (int i = 0; i < selectedScoreObjects.length; i++) {
            ScoreObject sObj = selectedScoreObjects[i];
            startTimes[i] = sObj.getStartTime();
            minTranslation = Math.max(minTranslation, -startTimes[i]);
        }

        selection.startTranslation();
    }

    @Override
    public void mouseDragged(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        e.consume();

        AlphaMarquee marquee = scoreTC.getMarquee();

        if (SwingUtilities.isLeftMouseButton(e)) {
            int x = e.getX();
            int diffX = x - startX;

            double translation = diffX / (double) timeState.getPixelSecond();
            

            if (timeState.isSnapEnabled() && !e.isControlDown()) {
                double newTime = ScoreUtilities.getSnapValueMove(
                        -minTranslation + translation, timeState.getSnapValue());

                translation = newTime + minTranslation;
            }
            
            translation = Math.max(translation, minTranslation);
            
            selection.updateTranslation(translation);

            int marqueeX = (int) ((marquee.startTime + translation) * timeState.getPixelSecond());
            marquee.setLocation(marqueeX, marquee.getY());

            for (int i = 0; i < selectedScoreObjects.length; i++) {
                ScoreObject sObj = selectedScoreObjects[i];
                sObj.setStartTime(startTimes[i] + translation);
            }
        }

        checkScroll(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        e.consume();
        if (SwingUtilities.isLeftMouseButton(e)) {
            AlphaMarquee marquee = scoreTC.getMarquee();

            marquee.startTime += selection.getTranslationTime();
            marquee.endTime += selection.getTranslationTime();
            
            selection.endTranslation();
        }

        timeState = null;
    }

    private boolean isMultiLineMode() {
        return ModeManager.getInstance().getMode() == ScoreMode.MULTI_LINE;
    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.MULTI_LINE;
    }

}
