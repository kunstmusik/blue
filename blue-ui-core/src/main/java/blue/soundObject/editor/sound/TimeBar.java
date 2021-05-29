/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.soundObject.editor.sound;

import blue.ui.utilities.GraphLabels;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.text.DecimalFormat;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javax.swing.JPanel;
import javax.swing.UIManager;

/**
 *
 * @author stevenyi
 */
public class TimeBar extends JPanel {

    DoubleProperty startTime = new SimpleDoubleProperty(0.0);
    DoubleProperty duration = new SimpleDoubleProperty(1.0);
    Font f = UIManager.getFont("Label.font").deriveFont(Font.PLAIN, 10);
    DecimalFormat df = new DecimalFormat();

    public TimeBar() {
//        repaint();

//        boundsInParentProperty().addListener((obs, old, newVal) -> repaint());
    
        setBackground(new Color(32, 32, 32));
        startTime.addListener((obs, old, newVal) -> repaint());
        duration.addListener((obs, old, newVal) -> repaint());
        setPreferredSize(new Dimension(0, 20));
    }

    @Override
    protected void paintComponent(final Graphics g) {
        super.paintComponent(g); 
        final var w = getWidth();
        final var h = getHeight();
        
        g.setColor(getBackground());
        g.fillRect(0, 0, w, h);
        
        g.setColor(Color.WHITE);
        g.setFont(f);
        
        GraphLabels.drawTicks(getStartTime(), getStartTime() + getDuration(), (int) (w / 100),
                (num, nfrac) -> {
                    df.setMaximumFractionDigits(nfrac);
                    df.setMinimumFractionDigits(nfrac);
                    String txt = df.format(num);
                    int x = (int)(w * (num - getStartTime()) / getDuration());
                    g.drawLine(x, 10, x, h);
                    g.drawString(txt, 0 + x + 2, 16);
                });

    }

    public final void setStartTime(double value) {
        startTime.set(value);
    }

    public final double getStartTime() {
        return startTime.get();
    }

    public final DoubleProperty startTimeProperty() {
        return startTime;
    }

    public final void setDuration(double value) {
        duration.set(value);
    }

    public final double getDuration() {
        return duration.get();
    }

    public final DoubleProperty durationProperty() {
        return duration;
    }

}
