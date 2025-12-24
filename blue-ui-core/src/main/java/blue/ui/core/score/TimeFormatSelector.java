/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score;

import blue.score.TimeState;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.ListCellRenderer;
import javax.swing.SwingConstants;

/**
 * Dropdown component for selecting the timeline ruler display format.
 * 
 * <p>This is part of Sprint 5 UI Layer Features for the new time system.
 * Option C design - Compact with Expandable Details.</p>
 * 
 * <p>The selector allows users to choose between different time display
 * formats: Beats, Measures:Beats, Time, SMPTE, and Samples. Changes are
 * reflected in the TimeBar/timeline ruler.</p>
 *
 * @author Steven Yi
 * @since 3.0
 */
public class TimeFormatSelector extends JComboBox<TimeDisplayFormat> 
        implements PropertyChangeListener {
    
    private TimeState timeState;
    private boolean isUpdating = false;
    
    /**
     * Creates a new TimeFormatSelector.
     */
    public TimeFormatSelector() {
        super(new DefaultComboBoxModel<>(TimeDisplayFormat.values()));
        
        // Use custom renderer to show format with example
        setRenderer(createRenderer());
        
        // Set a reasonable fixed width to prevent layout issues
        setPreferredSize(new Dimension(180, 24));
        setMaximumSize(new Dimension(200, 28));
        
        // Allow dropdown popup to be wider than the component
        setPrototypeDisplayValue(TimeDisplayFormat.BBST);
        
        // Handle selection changes
        addActionListener(this::onSelectionChanged);
        
        // Set tooltip
        setToolTipText("Select timeline display format");
    }
    
    /**
     * Creates the list cell renderer for the dropdown.
     */
    private ListCellRenderer<? super TimeDisplayFormat> createRenderer() {
        return (list, value, index, isSelected, cellHasFocus) -> {
            JLabel label = new JLabel();
            if (value != null) {
                // Show full label in dropdown, display name when collapsed
                if (index == -1) {
                    // Collapsed view - show just the name
                    label.setText(value.getDisplayName());
                } else {
                    // Dropdown view - show name with example
                    label.setText(value.getMenuLabel());
                }
            }
            label.setOpaque(true);
            label.setHorizontalAlignment(SwingConstants.LEFT);
            
            if (isSelected) {
                label.setBackground(list.getSelectionBackground());
                label.setForeground(list.getSelectionForeground());
            } else {
                label.setBackground(list.getBackground());
                label.setForeground(list.getForeground());
            }
            
            return label;
        };
    }
    
    /**
     * Handles selection changes in the dropdown.
     */
    private void onSelectionChanged(ActionEvent e) {
        if (isUpdating || timeState == null) {
            return;
        }
        
        TimeDisplayFormat selected = (TimeDisplayFormat) getSelectedItem();
        if (selected != null) {
            isUpdating = true;
            try {
                // Update TimeState with the legacy value for backward compatibility
                timeState.setTimeDisplay(selected.toTimeStateValue());
                
                // Fire property change for the new format enum
                // This allows components to react to the specific format change
                firePropertyChange("timeDisplayFormat", null, selected);
            } finally {
                isUpdating = false;
            }
        }
    }
    
    /**
     * Sets the TimeState to control.
     * 
     * @param timeState the TimeState to bind to, or null to unbind
     */
    public void setTimeState(TimeState timeState) {
        // Remove old listener
        if (this.timeState != null) {
            this.timeState.removePropertyChangeListener(this);
        }
        
        this.timeState = timeState;
        
        // Add new listener and sync state
        if (timeState != null) {
            timeState.addPropertyChangeListener(this);
            syncFromTimeState();
        }
    }
    
    /**
     * Gets the currently bound TimeState.
     * 
     * @return the current TimeState, or null if not bound
     */
    public TimeState getTimeState() {
        return timeState;
    }
    
    /**
     * Synchronizes the selector state from TimeState.
     */
    private void syncFromTimeState() {
        if (timeState != null && !isUpdating) {
            isUpdating = true;
            try {
                TimeDisplayFormat format = TimeDisplayFormat.fromTimeStateValue(
                        timeState.getTimeDisplay());
                setSelectedItem(format);
            } finally {
                isUpdating = false;
            }
        }
    }
    
    /**
     * Gets the currently selected time display format.
     * 
     * @return the selected TimeDisplayFormat
     */
    public TimeDisplayFormat getSelectedFormat() {
        return (TimeDisplayFormat) getSelectedItem();
    }
    
    /**
     * Sets the selected time display format.
     * 
     * @param format the format to select
     */
    public void setSelectedFormat(TimeDisplayFormat format) {
        setSelectedItem(format);
    }
    
    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if ("timeDisplay".equals(evt.getPropertyName())) {
            syncFromTimeState();
        }
    }
}
