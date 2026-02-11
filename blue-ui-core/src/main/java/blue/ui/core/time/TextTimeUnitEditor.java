/*
 * blue - object composition environment for csound
 * Copyright (C) 2025
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
package blue.ui.core.time;

import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimePosition;
import java.awt.BorderLayout;
import java.util.function.Supplier;

/**
 * A unified text-based TimePosition editor that works with all TimeBase formats.
 * Uses TimeUnitTextField for text input with format-specific parsing and display.
 * 
 * @author steven yi
 */
public class TextTimeUnitEditor extends TimeUnitEditor {

    private final TimeUnitTextField textField;
    private TimeBase timeBase = TimeBase.CSOUND_BEATS;

    public TextTimeUnitEditor() {
        super();
        setLayout(new BorderLayout());

        textField = new TimeUnitTextField();
        add(textField, BorderLayout.CENTER);

        textField.addChangeListener(e -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
    }

    /**
     * Gets the current TimeBase format.
     */
    public TimeBase getTimeBase() {
        return timeBase;
    }

    /**
     * Sets the TimeBase format for parsing and display.
     */
    public void setTimeBase(TimeBase timeBase) {
        this.timeBase = timeBase;
        textField.setTimeBase(timeBase);
    }

    /**
     * Sets duration mode for 0-based measure display.
     */
    public void setDurationMode(boolean durationMode) {
        textField.setDurationMode(durationMode);
    }

    /**
     * Sets the TimeContext supplier for duration mode conversions.
     */
    public void setTimeContextSupplier(Supplier<TimeContext> supplier) {
        textField.setTimeContextSupplier(supplier);
    }

    @Override
    protected void updateDisplay() {
        textField.setTimePosition(getTimePosition());
    }

    @Override
    protected TimePosition updateModel() {
        return textField.getTimePosition();
    }

    @Override
    protected void enableComponents(boolean enabled) {
        textField.setEnabled(enabled);
    }
}
