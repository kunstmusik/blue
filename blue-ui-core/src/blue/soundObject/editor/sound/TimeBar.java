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
import java.text.DecimalFormat;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.Text;

/**
 *
 * @author stevenyi
 */
public class TimeBar extends Canvas {

    DoubleProperty startTime = new SimpleDoubleProperty(0.0);
    DoubleProperty duration = new SimpleDoubleProperty(1.0);
    Font f = Font.font("System", FontWeight.LIGHT, 10);
    Text t = new Text();
    DecimalFormat df = new DecimalFormat();

    public TimeBar() {
        repaint();

        boundsInParentProperty().addListener((obs, old, newVal) -> repaint());
        startTime.addListener((obs, old, newVal) -> repaint());
        duration.addListener((obs, old, newVal) -> repaint());

        getGraphicsContext2D().setFont(f);
        t.setFont(f);
    }

    public final void repaint() {
        GraphicsContext gc = getGraphicsContext2D();
        double w = getWidth();
        double h = getHeight();

        gc.setFill(Color.BLACK);
        gc.fillRect(0, 0, w, h);

        gc.setStroke(Color.WHITE);

        GraphLabels.drawTicks(getStartTime(), getStartTime() + getDuration(), (int) (w / 100),
                (num, nfrac) -> {
                    df.setMaximumFractionDigits(nfrac);
                    df.setMinimumFractionDigits(nfrac);
                    String txt = df.format(num);
                    t.setText(txt);
                    double x = getWidth() * (num - getStartTime()) / getDuration();
                    gc.strokeLine(x, 10, x, h);
                    gc.strokeText(txt, 0 + x + 2, 16);
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
