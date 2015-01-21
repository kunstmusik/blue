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

import blue.BlueSystem;
import blue.score.TimeState;
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

        int shortcutKey = BlueSystem.getMenuShortcutKey();

        if (e.isAltDown()) {
            
            if(timeState == null) {
                return;
            }
            int value = e.getWheelRotation();

            final int xLoc = e.getX();
            final float timeVal = xLoc / (float) timeState.getPixelSecond();

            if (value > 0) {
                timeState.raisePixelSecond();
            } else {
                timeState.lowerPixelSecond();
            }

            SwingUtilities.invokeLater(new Runnable() {

                @Override
                public void run() {
                    int newVal = (int) (timeVal * timeState.getPixelSecond());

                    newVal -= xLoc;

                    if (newVal > 0) {
                        //FIXME
                        scrollPane.getHorizontalScrollBar().setValue(newVal);
                    }

                }
            });
            e.consume();
        } else if (e.isShiftDown()) {

            int value = e.getWheelRotation();

            value = (value > 0) ? 1 : -1;

            JScrollBar scrollBar = scrollPane.getHorizontalScrollBar();

            scrollBar.setValue(
                    scrollBar.getValue() + (value * scrollBar.getBlockIncrement()));

            e.consume();
        } else {

            int value = e.getWheelRotation();

            value = (value > 0) ? 1 : -1;

            JScrollBar scrollBar = scrollPane.getVerticalScrollBar();

            scrollBar.setValue(
                    scrollBar.getValue() + (value * scrollBar.getBlockIncrement()));

            e.consume();
        }
    }
}
