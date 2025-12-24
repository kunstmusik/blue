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
 * Editor for BBT/BBST/BBF TimeUnits. Displays spinners for editing
 * bar, beat, sixteenth, and ticks (for BBST format).
 * 
 * TODO: Update to support text-based BBT/BBST/BBF input
 * 
 * @author steven yi
 */
public class MeasureTimeEditor extends TimeUnitEditor {
    
    private final JLabel barLabel;
    private final JSpinner barSpinner;
    private final JLabel beatLabel;
    private final JSpinner beatSpinner;
    private final JLabel sixteenthLabel;
    private final JSpinner sixteenthSpinner;
    private final JLabel ticksLabel;
    private final JSpinner ticksSpinner;
    
    /**
     * Creates a new MeasureTimeEditor for BBST format.
     */
    public MeasureTimeEditor() {
        super();
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(0, 0, 0, 3);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        
        // Bar spinner (long, min 1)
        barLabel = new JLabel("Bar:");
        SpinnerNumberModel barModel = new SpinnerNumberModel(1L, 1L, Long.MAX_VALUE, 1L);
        barSpinner = new JSpinner(barModel);
        configureSpinnerEditor(barSpinner, "0");
        
        // Beat spinner (int, 1-4 for 4/4)
        beatLabel = new JLabel("Beat:");
        SpinnerNumberModel beatModel = new SpinnerNumberModel(1, 1, 16, 1);
        beatSpinner = new JSpinner(beatModel);
        configureSpinnerEditor(beatSpinner, "0");
        
        // Sixteenth spinner (int, 1-4)
        sixteenthLabel = new JLabel("16th:");
        SpinnerNumberModel sixteenthModel = new SpinnerNumberModel(1, 1, 4, 1);
        sixteenthSpinner = new JSpinner(sixteenthModel);
        configureSpinnerEditor(sixteenthSpinner, "0");
        
        // Ticks spinner (int, 0-119 for PPQ=480)
        ticksLabel = new JLabel("Ticks:");
        SpinnerNumberModel ticksModel = new SpinnerNumberModel(0, 0, 119, 1);
        ticksSpinner = new JSpinner(ticksModel);
        configureSpinnerEditor(ticksSpinner, "0");
        
        // Layout: Bar label + spinner
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.weightx = 0.0;
        add(barLabel, gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.25;
        add(barSpinner, gbc);

        // Beat label + spinner
        gbc.gridx = 2;
        gbc.weightx = 0.0;
        add(beatLabel, gbc);
        gbc.gridx = 3;
        gbc.weightx = 0.25;
        add(beatSpinner, gbc);

        // Sixteenth label + spinner
        gbc.gridx = 4;
        gbc.weightx = 0.0;
        add(sixteenthLabel, gbc);
        gbc.gridx = 5;
        gbc.weightx = 0.25;
        add(sixteenthSpinner, gbc);

        // Ticks label + spinner
        gbc.gridx = 6;
        gbc.weightx = 0.0;
        add(ticksLabel, gbc);
        gbc.gridx = 7;
        gbc.weightx = 0.25;
        gbc.insets = new Insets(0, 0, 0, 0);
        add(ticksSpinner, gbc);
        
        // Listen for changes
        barSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) fireStateChanged();
        });
        beatSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) fireStateChanged();
        });
        sixteenthSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) fireStateChanged();
        });
        ticksSpinner.addChangeListener((ChangeEvent e) -> {
            if (!isUpdating()) fireStateChanged();
        });
    }
    
    @Override
    protected void updateDisplay() {
        TimeUnit timeUnit = getTimeUnit();
        if (timeUnit instanceof TimeUnit.BBSTTime bbst) {
            barSpinner.setValue(bbst.getBar());
            beatSpinner.setValue(bbst.getBeat());
            sixteenthSpinner.setValue(bbst.getSixteenth());
            ticksSpinner.setValue(bbst.getTicks());
        } else if (timeUnit instanceof TimeUnit.BBTTime bbt) {
            // Convert BBT to BBST for display
            TimeUnit.BBSTTime bbst = bbt.toBBST(480); // Default PPQ
            barSpinner.setValue(bbst.getBar());
            beatSpinner.setValue(bbst.getBeat());
            sixteenthSpinner.setValue(bbst.getSixteenth());
            ticksSpinner.setValue(bbst.getTicks());
        } else if (timeUnit instanceof TimeUnit.BBFTime bbf) {
            // Convert BBF to BBST for display
            TimeUnit.BBSTTime bbst = bbf.toBBST(480); // Default PPQ
            barSpinner.setValue(bbst.getBar());
            beatSpinner.setValue(bbst.getBeat());
            sixteenthSpinner.setValue(bbst.getSixteenth());
            ticksSpinner.setValue(bbst.getTicks());
        } else {
            barSpinner.setValue(1L);
            beatSpinner.setValue(1);
            sixteenthSpinner.setValue(1);
            ticksSpinner.setValue(0);
        }
    }
    
    @Override
    protected TimeUnit updateModel() {
        long bar = ((Number) barSpinner.getValue()).longValue();
        int beat = ((Number) beatSpinner.getValue()).intValue();
        int sixteenth = ((Number) sixteenthSpinner.getValue()).intValue();
        int ticks = ((Number) ticksSpinner.getValue()).intValue();
        return TimeUnit.bbst(bar, beat, sixteenth, ticks);
    }
    
    @Override
    protected void enableComponents(boolean enabled) {
        barLabel.setEnabled(enabled);
        barSpinner.setEnabled(enabled);
        beatLabel.setEnabled(enabled);
        beatSpinner.setEnabled(enabled);
        sixteenthLabel.setEnabled(enabled);
        sixteenthSpinner.setEnabled(enabled);
        ticksLabel.setEnabled(enabled);
        ticksSpinner.setEnabled(enabled);
    }
    
    private static void configureSpinnerEditor(JSpinner spinner, String pattern) {
        JSpinner.NumberEditor editor = new JSpinner.NumberEditor(spinner, pattern);
        spinner.setEditor(editor);
        editor.getTextField().setColumns(3);
    }
}
