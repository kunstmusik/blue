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

import blue.time.TimePosition;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import javax.swing.JLabel;
import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;

/**
 * Editor for TimeValue TimeUnits. Displays spinners for editing
 * hours, minutes, seconds, and milliseconds.
 * 
 * @author steven yi
 */
public class SecondTimeEditor extends TimeUnitEditor {
    
    private final JSpinner hoursSpinner;
    private final JSpinner minutesSpinner;
    private final JSpinner secondsSpinner;
    private final JSpinner millisecondsSpinner;
    
    /**
     * Creates a new SecondTimeEditor.
     */
    public SecondTimeEditor() {
        super();
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(0, 0, 0, 5); // 5px gap between components
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        
        // Hours
        SpinnerNumberModel hoursModel = new SpinnerNumberModel(0L, 0L, Long.MAX_VALUE, 1L);
        hoursSpinner = new JSpinner(hoursModel);
        configureSpinnerEditor(hoursSpinner, "0");
        
        // Minutes (0-59)
        SpinnerNumberModel minutesModel = new SpinnerNumberModel(0L, 0L, 59L, 1L);
        minutesSpinner = new JSpinner(minutesModel);
        configureSpinnerEditor(minutesSpinner, "00");
        
        // Seconds (0-59)
        SpinnerNumberModel secondsModel = new SpinnerNumberModel(0L, 0L, 59L, 1L);
        secondsSpinner = new JSpinner(secondsModel);
        configureSpinnerEditor(secondsSpinner, "00");
        
        // Milliseconds (0-999)
        SpinnerNumberModel millisecondsModel = new SpinnerNumberModel(0L, 0L, 999L, 1L);
        millisecondsSpinner = new JSpinner(millisecondsModel);
        configureSpinnerEditor(millisecondsSpinner, "000");
        
        // Add Hours spinner - equal weight
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.weightx = 0.25; // 1/4 of available space
        add(hoursSpinner, gbc);
        
        // Add colon separator - fixed size
        gbc.gridx = 1;
        gbc.weightx = 0.0;
        add(new JLabel(":"), gbc);
        
        // Add Minutes spinner - equal weight
        gbc.gridx = 2;
        gbc.weightx = 0.25; // 1/4 of available space
        add(minutesSpinner, gbc);
        
        // Add colon separator - fixed size
        gbc.gridx = 3;
        gbc.weightx = 0.0;
        add(new JLabel(":"), gbc);
        
        // Add Seconds spinner - equal weight
        gbc.gridx = 4;
        gbc.weightx = 0.25; // 1/4 of available space
        add(secondsSpinner, gbc);
        
        // Add period separator - fixed size
        gbc.gridx = 5;
        gbc.weightx = 0.0;
        add(new JLabel("."), gbc);
        
        // Add Milliseconds spinner - equal weight
        gbc.gridx = 6;
        gbc.weightx = 0.25; // 1/4 of available space
        gbc.insets = new Insets(0, 0, 0, 0); // No gap after last component
        add(millisecondsSpinner, gbc);
        
        // Listen for changes
        hoursSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
        
        minutesSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
        
        secondsSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
        
        millisecondsSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
    }

    private static void configureSpinnerEditor(JSpinner spinner, String pattern) {
        JSpinner.NumberEditor editor = new JSpinner.NumberEditor(spinner, pattern);
        spinner.setEditor(editor);
        editor.getTextField().setColumns(pattern.length());
    }
    
    @Override
    protected void updateDisplay() {
        TimePosition timePosition = getTimePosition();
        if (timePosition instanceof TimePosition.TimeValue timeValue) {
            hoursSpinner.setValue(timeValue.getHours());
            minutesSpinner.setValue(timeValue.getMinutes());
            secondsSpinner.setValue(timeValue.getSeconds());
            millisecondsSpinner.setValue(timeValue.getMilliseconds());
        } else {
            hoursSpinner.setValue(0L);
            minutesSpinner.setValue(0L);
            secondsSpinner.setValue(0L);
            millisecondsSpinner.setValue(0L);
        }
    }
    
    @Override
    protected TimePosition updateModel() {
        long hours = ((Number) hoursSpinner.getValue()).longValue();
        long minutes = ((Number) minutesSpinner.getValue()).longValue();
        long seconds = ((Number) secondsSpinner.getValue()).longValue();
        long milliseconds = ((Number) millisecondsSpinner.getValue()).longValue();
        return TimePosition.time(hours, minutes, seconds, milliseconds);
    }
    
    @Override
    protected void enableComponents(boolean enabled) {
        hoursSpinner.setEnabled(enabled);
        minutesSpinner.setEnabled(enabled);
        secondsSpinner.setEnabled(enabled);
        millisecondsSpinner.setEnabled(enabled);
    }
}
