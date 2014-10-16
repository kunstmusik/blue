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
package blue.soundObject.editor.pattern;

import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JComponent;

import blue.soundObject.PatternObject;

public class PatternTimeBar extends JComponent implements
        PropertyChangeListener {
    private static final Font LABEL_FONT = new Font("dialog", Font.PLAIN, 11);

    private PatternObject patternObj = null;

    public PatternTimeBar() {
        this.setPreferredSize(new Dimension(50,
                PatternsConstants.patternViewHeight));
    }

    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        int w = getSize().width;
        int h = PatternsConstants.patternViewHeight;

//        g.setColor(BlueLookAndFeel.getPrimaryControl());
        g.setColor(getForeground());
        g.setFont(LABEL_FONT);

        g.drawLine(0, h - 1, w, h - 1);

        if (patternObj == null) {
            return;
        }

        int beats = patternObj.getBeats();
        int subDivisions = patternObj.getSubDivisions();

        int count = beats * subDivisions;

        for (int i = 0; i < beats; i++) {
            g.drawLine(i * h * subDivisions, 0, i * h * subDivisions, h);
            g.drawString(Integer.toString(i + 1), (i * h * subDivisions) + 3,
                    14);
        }

        g.drawLine(count * h, 0, count * h, h);
    }

    public void setPatternObject(PatternObject p) {
        if (this.patternObj != null) {
            this.patternObj.removePropertyChangeListener(this);
        }

        this.patternObj = p;
        this.patternObj.addPropertyChangeListener(this);

        checkSize();
        repaint();
    }

    private void checkSize() {
        int height = PatternsConstants.patternViewHeight;
        int width = patternObj.getBeats() * patternObj.getSubDivisions()
                * height;

        this.setPreferredSize(new Dimension(width, height));
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.patternObj) {
            if (evt.getPropertyName().equals("time")) {
                checkSize();
                repaint();
            }
        }
    }
}
