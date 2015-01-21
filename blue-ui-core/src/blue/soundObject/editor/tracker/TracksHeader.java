/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.editor.tracker;

import blue.soundObject.TrackerObject;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JComponent;

public class TracksHeader extends JComponent implements PropertyChangeListener {

    TrackerObject tracker = null;

    public TracksHeader() {
        this.setDoubleBuffered(true);
        this.setBackground(Color.BLACK);
    }

    public void setTracker(TrackerObject tracker) {
        if (this.tracker != null) {
            this.tracker.removePropertyChangeListener(this);
        }

        this.tracker = tracker;
        this.tracker.addPropertyChangeListener(this);

        updateHeight();

        repaint();
    }

    private void updateHeight() {
        if (this.tracker == null) {
            return;
        }

        int steps = tracker.getSteps();

        int h = 16 * steps;

        if (this.getHeight() != h) {
            Dimension d = new Dimension(getWidth(), h);
            this.setSize(d);
            this.setPreferredSize(d);
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        if (tracker == null) {
            return;
        }

        int steps = tracker.getSteps();

        int h = 16 * steps;

        g.setColor(Color.BLACK);
        g.fillRect(0, 0, getWidth(), h);

        g.setColor(Color.WHITE);

        if (tracker != null) {

            for (int i = 0; i < steps; i++) {

                // int y = (i + 1) * table.getRowHeight();

                int y = (i + 1) * 16;

                if (i % 4 == 0) {
                    g.setColor(Color.DARK_GRAY);
                    g.fillRect(0, y - 16, getWidth(), 16);

                    g.setColor(Color.WHITE);
                }

                y -= 4;

                String label = (i < 10) ? "0" + i : Integer.toString(i);

                g.drawString(label, 2, y);
            }

        }

        g.drawLine(getWidth() - 1, 0, getWidth() - 1, h);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.tracker) {
            if (evt.getPropertyName().equals("steps")) {
                updateHeight();
            }
        }
    }

}
