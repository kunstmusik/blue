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

import java.awt.event.MouseEvent;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;

/**
 *
 * @author syi
 */
public class ScoreMouseWheelListener implements MouseWheelListener {

    JScrollPane scrollPane;

    MouseWheelListener[] listeners;

    private final TimePixelManager timePixel;

    public ScoreMouseWheelListener(JScrollPane scrollPane,
            TimePixelManager timePixel) {
        this.scrollPane = scrollPane;
        this.timePixel = timePixel;

        listeners = scrollPane.getMouseWheelListeners();

        for (int i = 0; i < listeners.length; i++) {
            scrollPane.removeMouseWheelListener(listeners[i]);
        }

        scrollPane.addMouseWheelListener(this);
    }

    public void mouseWheelMoved(MouseWheelEvent e) {
        final ScoreTimeCanvas sTimeCanvas = (ScoreTimeCanvas) scrollPane.getViewport().getView();

        if (e.isControlDown()) {
            int value = e.getWheelRotation();

            MouseEvent transPoint = SwingUtilities.convertMouseEvent(
                    scrollPane, e, sTimeCanvas);

            final int xLoc = e.getX();
            final float timeVal = transPoint.getX() / (float) sTimeCanvas.pObj.getPixelSecond();

            if (value > 0) {
                timePixel.raisePixelSecond();
            } else {
                timePixel.lowerPixelSecond();
            }

            SwingUtilities.invokeLater(new Runnable() {

                public void run() {
                    int newVal = (int) (timeVal * sTimeCanvas.pObj.getPixelSecond());

                    newVal -= xLoc;

                    if (newVal > 0) {
                        scrollPane.getHorizontalScrollBar().setValue(newVal);
                    }

                }
            });

        } else if (e.isShiftDown()) {
            MouseEvent transPoint = SwingUtilities.convertMouseEvent(
                    scrollPane, e, sTimeCanvas);

            int value = e.getWheelRotation();

            value = (value > 0) ? 1 : -1;

            sTimeCanvas.modifyLayerHeight(value, transPoint.getY());
        } else {
            for (int i = 0; i < listeners.length; i++) {
                listeners[i].mouseWheelMoved(e);
            }
        }
    }
}