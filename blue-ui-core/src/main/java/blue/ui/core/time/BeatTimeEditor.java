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
 * Editor for BeatTime TimeUnits. Displays a single spinner for editing
 * Csound beats as a double value.
 * 
 * @author steven yi
 */
public class BeatTimeEditor extends TimeUnitEditor {
    
    private final JSpinner beatsSpinner;
    private final JLabel beatsLabel;
    
    /**
     * Creates a new BeatTimeEditor.
     */
    public BeatTimeEditor() {
        super();
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(0, 0, 0, 5); // 5px gap between components
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        
        // Create spinner with reasonable defaults
        // Min: 0.0, Initial: 0.0, Step: 0.25 (sixteenth note)
        SpinnerNumberModel model = new SpinnerNumberModel(0.0, 0.0, Double.MAX_VALUE, 0.25);
        beatsSpinner = new JSpinner(model);
        
        // Set editor to show decimal places
        JSpinner.NumberEditor editor = new JSpinner.NumberEditor(beatsSpinner, "0.####");
        beatsSpinner.setEditor(editor);
        
        beatsLabel = new JLabel("beats");
        
        // Add spinner - expandable
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.weightx = 1.0; // Spinner takes all available space
        add(beatsSpinner, gbc);
        
        // Add label - fixed size
        gbc.gridx = 1;
        gbc.weightx = 0.0; // Label stays fixed size
        gbc.insets = new Insets(0, 5, 0, 0); // Gap between spinner and label
        add(beatsLabel, gbc);
        gbc.insets = new Insets(0, 0, 0, 0);
        
        // Listen for changes
        beatsSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) {
                fireStateChanged();
            }
        });
    }
    
    @Override
    protected void updateDisplay() {
        TimeUnit timeUnit = getTimeUnit();
        if (timeUnit instanceof TimeUnit.BeatTime beatTime) {
            beatsSpinner.setValue(beatTime.getCsoundBeats());
        } else {
            beatsSpinner.setValue(0.0);
        }
    }
    
    @Override
    protected TimeUnit updateModel() {
        double beats = ((Number) beatsSpinner.getValue()).doubleValue();
        return TimeUnit.beats(beats);
    }
    
    @Override
    protected void enableComponents(boolean enabled) {
        beatsSpinner.setEnabled(enabled);
        beatsLabel.setEnabled(enabled);
    }
}
