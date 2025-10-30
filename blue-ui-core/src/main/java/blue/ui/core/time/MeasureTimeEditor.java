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

import blue.time.TimeUnit;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import javax.swing.JLabel;
import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;

/**
 * Editor for MeasureTime TimeUnits. Displays two spinners for editing
 * measure number (long) and beat within measure (double).
 * 
 * @author steven yi
 */
public class MeasureTimeEditor extends TimeUnitEditor {
    
    private final JLabel measureLabel;
    private final JSpinner measureSpinner;
    private final JLabel beatLabel;
    private final JSpinner beatSpinner;
    
    /**
     * Creates a new MeasureTimeEditor.
     */
    public MeasureTimeEditor() {
        super();
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(0, 0, 0, 5); // 5px gap between components
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        
        // Measure spinner (long, min 1)
        measureLabel = new JLabel("Measure:");
        SpinnerNumberModel measureModel = new SpinnerNumberModel(1L, 1L, Long.MAX_VALUE, 1L);
        measureSpinner = new JSpinner(measureModel);
        configureSpinnerEditor(measureSpinner, "0");
        
        // Beat spinner (double, min 0.0)
        beatLabel = new JLabel("Beat:");
        SpinnerNumberModel beatModel = new SpinnerNumberModel(0.0, 0.0, Double.MAX_VALUE, 0.25);
        beatSpinner = new JSpinner(beatModel);
        
        // Set editor to show decimal places for beats
        configureSpinnerEditor(beatSpinner, "0.####");
        
        // Add Measure label - fixed size
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.weightx = 0.0;
        gbc.insets = new Insets(0, 0, 0, 5);
        add(measureLabel, gbc);

        // Add Measure spinner - expandable, equal weight
        gbc.gridx = 1;
        gbc.weightx = 0.5; // Half the available space
        add(measureSpinner, gbc);

        // Add Beat label - fixed size
        gbc.gridx = 2;
        gbc.weightx = 0.0;
        gbc.insets = new Insets(0, 5, 0, 5);
        add(beatLabel, gbc);

        // Add Beat spinner - expandable, equal weight
        gbc.gridx = 3;
        gbc.weightx = 0.5; // Half the available space
        gbc.insets = new Insets(0, 0, 0, 0);
        add(beatSpinner, gbc);
        
        // Reset insets for any future additions
        gbc.insets = new Insets(0, 0, 0, 0);
        
        // Listen for changes
        measureSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
        
        beatSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
    }
    
    @Override
    protected void updateDisplay() {
        TimeUnit timeUnit = getTimeUnit();
        if (timeUnit instanceof TimeUnit.MeasureBeatsTime measureTime) {
            measureSpinner.setValue(measureTime.getMeasureNumber());
            beatSpinner.setValue(measureTime.getBeatNumber());
        } else {
            measureSpinner.setValue(1L);
            beatSpinner.setValue(1.0);
        }
    }
    
    @Override
    protected TimeUnit updateModel() {
        long measure = ((Number) measureSpinner.getValue()).longValue();
        double beat = ((Number) beatSpinner.getValue()).doubleValue();
        return TimeUnit.measureBeats(measure, beat);
    }
    
    @Override
    protected void enableComponents(boolean enabled) {
        measureLabel.setEnabled(enabled);
        measureSpinner.setEnabled(enabled);
        beatLabel.setEnabled(enabled);
        beatSpinner.setEnabled(enabled);
    }
    
    private static void configureSpinnerEditor(JSpinner spinner, String pattern) {
        JSpinner.NumberEditor editor = new JSpinner.NumberEditor(spinner, pattern);
        spinner.setEditor(editor);
        editor.getTextField().setColumns(pattern.replace("#", "0").length());
    }
}
