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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.css.CssMetaData;
import javafx.css.SimpleStyleableObjectProperty;
import javafx.css.StyleConverter;
import javafx.css.Styleable;
import javafx.css.StyleableObjectProperty;
import javafx.css.StyleableProperty;
import javafx.scene.control.Control;
import javafx.scene.control.Skin;
import javafx.scene.paint.Color;

/**
 *
 * @author stevenyi
 */
public class Knob extends Control {

	StyleableObjectProperty<Color> trackBackgroundColor;
	StyleableObjectProperty<Color> trackColor;

	DoubleProperty value;
	DoubleProperty min;
	DoubleProperty max;

	public Knob() {
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

	public double getRange() {
		return getMax() - getMin();
	}

	/* CSS STYLEABLE PROPERTIES */
	public Color getTrackBackgroundColor() {
		return (trackBackgroundColor == null) ? Color.rgb(0, 0, 0, 0.25) : trackBackgroundColor.get();
	}

	public void setTrackBackgroundColor(Color trackBackgroundColor) {
		trackBackgroundColorProperty().set(trackBackgroundColor);
	}

	public StyleableObjectProperty<Color> trackBackgroundColorProperty() {
		if (trackBackgroundColor == null) {
			trackBackgroundColor = new SimpleStyleableObjectProperty<>(
				StyleableProperties.TRACK_BACKGROUND_FILL, Knob.this, "trackBackgroundColor", Color.DARKGRAY);
		}
		return trackBackgroundColor;
	}

	public Color getTrackColor() {
		return trackColor == null ? Color.rgb(63, 102, 150) : trackColor.get();
	}

	public void setTrackColor(Color trackColor) {
		trackColorProperty().set(trackColor);
	}

	public StyleableObjectProperty<Color> trackColorProperty() {
		if (trackColor == null) {
			trackColor = new SimpleStyleableObjectProperty<>(
				StyleableProperties.TRACK_FILL, Knob.this, "trackColor", Color.DARKGRAY);
		}
		return trackColor;
	}

	private static class StyleableProperties {

		private static final CssMetaData<Knob, Color> TRACK_BACKGROUND_FILL
			= new CssMetaData<Knob, Color>("-fx-track-background-fill",
				                    StyleConverter.getColorConverter(), Color.DARKGRAY) {
				@Override
				public boolean isSettable(Knob control) {
					return control.trackBackgroundColor == null || !control.trackBackgroundColor.isBound();
				}

				@Override
				public StyleableProperty<Color> getStyleableProperty(Knob control) {
					return control.trackBackgroundColorProperty();
				}
			};

		private static final CssMetaData<Knob, Color> TRACK_FILL
			= new CssMetaData<Knob, Color>("-fx-track-fill",
				                    StyleConverter.getColorConverter(), Color.ALICEBLUE) {
				@Override
				public boolean isSettable(Knob control) {
					return control.trackColor == null || !control.trackColor.isBound();
				}

				@Override
				public StyleableProperty<Color> getStyleableProperty(Knob control) {
					return control.trackColorProperty();
				}
			};
		private static final List<CssMetaData<? extends Styleable, ?>> STYLEABLES;

		static {
			final List<CssMetaData<? extends Styleable, ?>> styleables
				= new ArrayList<>(Control.getClassCssMetaData());
			Collections.addAll(styleables, TRACK_BACKGROUND_FILL, TRACK_FILL);
			STYLEABLES = Collections.unmodifiableList(styleables);
		}
	}

	@Override
	public List<CssMetaData<? extends Styleable, ?>> getControlCssMetaData() {
		return getClassCssMetaData();
	}

	public static List<CssMetaData<? extends Styleable, ?>> getClassCssMetaData() {
		return StyleableProperties.STYLEABLES;
	}
}
