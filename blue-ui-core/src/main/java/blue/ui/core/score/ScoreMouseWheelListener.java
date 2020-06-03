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

import blue.score.TimeState;
import java.awt.Point;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import javax.swing.JScrollBar;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;

/**
 *
 * @author syi
 */
public class ScoreMouseWheelListener implements MouseWheelListener {

    JScrollPane scrollPane;
    MouseWheelListener[] listeners;
    TimeState timeState = null;

    public ScoreMouseWheelListener(JScrollPane scrollPane) {
        this.scrollPane = scrollPane;

        listeners = scrollPane.getMouseWheelListeners();

        for (int i = 0; i < listeners.length; i++) {
            scrollPane.removeMouseWheelListener(listeners[i]);
        }

        scrollPane.addMouseWheelListener(this);
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }

    @Override
    public void mouseWheelMoved(MouseWheelEvent e) {
        e.getComponent().requestFocus();
        //int shortcutKey = BlueSystem.getMenuShortcutKey();
        if (e.isAltDown()) {

            if (timeState == null) {
                return;
            }
            double value = e.getPreciseWheelRotation();

            final int xLoc = e.getX();
            final var viewPort = scrollPane.getViewport();

            final var localPt = SwingUtilities.convertPoint(e.getComponent(), e.getPoint(),
                    viewPort.getView());

            final var pos = viewPort.getViewPosition();

            final var initPixelSecond = timeState.getPixelSecond();

            if (value > 0) {
                timeState.raisePixelSecond();
            } else {
                timeState.lowerPixelSecond();
            }

            final var percent = timeState.getPixelSecond() / (double) initPixelSecond;

            final var newX = Math.max(percent * localPt.x - xLoc, 0);
            viewPort.setViewPosition(new Point((int) newX, pos.y));

            e.consume();
        } else if (e.isShiftDown()) {

            double value = e.getPreciseWheelRotation();

//            value = (value > 0) ? 1 : -1;
            JScrollBar scrollBar = scrollPane.getHorizontalScrollBar();

            scrollBar.setValue(
                    scrollBar.getValue() + (int) (value * scrollBar.getBlockIncrement()));

            e.consume();
        } else {

            double value = e.getPreciseWheelRotation();

            JScrollBar scrollBar = scrollPane.getVerticalScrollBar();

            scrollBar.setValue(
                    scrollBar.getValue() + (int) (value * scrollBar.getBlockIncrement()));

            e.consume();
        }
    }
}
