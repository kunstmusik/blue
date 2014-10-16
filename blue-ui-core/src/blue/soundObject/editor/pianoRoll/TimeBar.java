/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.pianoRoll;

import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Rectangle;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JComponent;

import blue.soundObject.PianoRoll;
import blue.soundObject.PolyObject;

/**
 * @author steven
 */

public final class TimeBar extends JComponent implements PropertyChangeListener {
    private static final Font LABEL_FONT = new Font("dialog", Font.PLAIN, 11);

    private PianoRoll pianoRoll;

    public TimeBar() {
        this.setDoubleBuffered(true);
        this.setLayout(null);

    }

    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (pianoRoll == null || this.getHeight() == 0 || this.getWidth() == 0) {
            return;
        }

        Rectangle bounds = g.getClipBounds();

        int h = 19;

        int startX = bounds.x;
        int endX = startX + bounds.width;

        int pixelTime = pianoRoll.getPixelSecond();
        int timeUnit = pianoRoll.getTimeUnit();

        int timeDisplay = pianoRoll.getTimeDisplay();

        int textWidth;

        FontMetrics fontMetrics = g.getFontMetrics();
        if (timeDisplay == PolyObject.DISPLAY_TIME) {
            textWidth = fontMetrics.stringWidth("00:00");
        } else {
            // Assuming less than 1000 measures
            textWidth = fontMetrics.stringWidth("000");
        }

        int lastVal = 0;

        //g.setColor(BlueLookAndFeel.getPrimaryControl());
        g.setColor(getForeground());
        g.drawLine(startX, h, endX, h);

        // Draw lines
//        int longHeight = (int) (h * .5);
//        int shortHeight = (int) (h * .75);
        
        int longHeight = h - 6;
        int shortHeight = h - 3;

        int start = (startX / pixelTime);

        for (int i = start; i * pixelTime < endX; i++) {
            int lineX = i * pixelTime;

            if (i % timeUnit == 0) {
                if (lineX == 0 || lineX - lastVal > textWidth) {
                    g.drawLine(lineX, h, lineX, longHeight);
                    lastVal = lineX;
                } else {
                    g.drawLine(lineX, h, lineX, shortHeight);
                }
            } else {
                g.drawLine(lineX, h, lineX, shortHeight);
            }
        }

        g.setFont(LABEL_FONT);

        // Draw Labels
        lastVal = 0;
        for (int i = start; i * pixelTime < endX; i++) {
            if (i % timeUnit == 0) {
                String time = "";
                if (timeDisplay == PianoRoll.DISPLAY_TIME) {
                    int min = i / 60;
                    int sec = i % 60;
                    String seconds = (sec < 10) ? "0" + sec : String
                            .valueOf(sec);
                    time = min + ":" + seconds;
                } else if (timeDisplay == PianoRoll.DISPLAY_NUMBER) {
                    time = Integer.toString(i);
                }

                int labelX = (i * pixelTime);

                if (labelX == 0 || labelX - lastVal > textWidth) {
                    g.drawString(time, labelX + 3, 14);
                    lastVal = labelX;
                }
            }
        }

    }

    public void editPianoRoll(PianoRoll pianoRoll) {
        if (this.pianoRoll != null) {
            this.pianoRoll.removePropertyChangeListener(this);
        }

        this.pianoRoll = pianoRoll;

        pianoRoll.addPropertyChangeListener(this);

        repaint();

    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyChangeListener#propertyChange(java.beans.PropertyChangeEvent)
     */
    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();

        if (evt.getSource() == this.pianoRoll) {
            if (prop.equals("timeDisplay") || prop.equals("timeUnit")
                    || prop.equals("pixelSecond")) {
                repaint();
            }
        }
    }

}