/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.jfx.controls;

import javafx.beans.property.DoubleProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.scene.control.Control;
import javafx.scene.control.Skin;
import javafx.scene.paint.Color;

/**
 *
 * @author stevenyi
 */
public class Knob extends Control{

    ObjectProperty<Color> trackBackgroundColor;
    ObjectProperty<Color> trackColor;

    DoubleProperty value; 
    DoubleProperty min; 
    DoubleProperty max; 

    public Knob() {
        trackBackgroundColor = new SimpleObjectProperty<>(Color.ALICEBLUE);
        trackColor = new SimpleObjectProperty<>(Color.ALICEBLUE.brighter().brighter());
        min = new SimpleDoubleProperty(0.0);
        max = new SimpleDoubleProperty(1.0);
        value = new SimpleDoubleProperty(0.0) {
            @Override
            public void set(double newValue) {
                boolean outOfBounds = newValue < getMin() || newValue > getMax();
                super.set(outOfBounds ? get() : newValue); 
            }
        };
    }
    
    @Override
    protected Skin<?> createDefaultSkin() {
        return new KnobSkin(this);
    }

    public void setValue(double value) {
        this.value.set(value);
    }

    public double getValue() {
        return value.get();
    }

    public DoubleProperty valueProperty() {
        return value;
    }

    public void setMin(double value) {
        min.set(value);
    }

    public double getMin() {
        return min.get();
    }

    public DoubleProperty minProperty() {
        return min;
    }

    public void setMax(Double value) {
        max.set(value);
    }

    public Double getMax() {
        return max.get();
    }

    public DoubleProperty maxProperty() {
        return max;
    }

    public Color getTrackBackgroundColor() {
        return trackBackgroundColor.get();
    }
    
    public void setTrackBackgroundColor(Color trackBackgroundColor) {
        this.trackBackgroundColor.set(trackBackgroundColor);
    }

    public ObjectProperty<Color> trackBackgroundColorProperty() {
        return trackBackgroundColor;
    }

    public Color getTrackColor() {
        return trackColor.get();
    }

    public void setTrackColor(Color trackColor) {
        this.trackColor.set(trackColor);
    }

    public ObjectProperty<Color> trackColorProperty() {
        return trackColor;
    }
     
    public double getRange() {
        return getMax() - getMin();
    } 
    
}
