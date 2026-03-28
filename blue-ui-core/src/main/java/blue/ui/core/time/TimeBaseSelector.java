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
import java.awt.Component;
import javax.swing.DefaultListCellRenderer;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JList;

/**
 * ComboBox for selecting a TimeBase. Displays user-friendly labels for each
 * TimeBase option.
 * 
 * @author steven yi
 */
public class TimeBaseSelector extends JComboBox<TimeBase> {
    
    /**
     * Creates a new TimeBaseSelector with all available TimeBases.
     */
    public TimeBaseSelector() {
        super(TimeBase.values());
        setRenderer(new TimeBaseRenderer());
        // Prevent overly wide preferred/min sizes driven by long display strings
        setPrototypeDisplayValue(TimeBase.BBST);
    }
    
    /**
     * Gets the currently selected TimeBase.
     * 
     * @return the selected TimeBase, or null if none selected
     */
    public TimeBase getSelectedTimeBase() {
        return (TimeBase) getSelectedItem();
    }
    
    /**
     * Sets the selected TimeBase.
     * 
     * @param timeBase the TimeBase to select
     */
    public void setSelectedTimeBase(TimeBase timeBase) {
        setSelectedItem(timeBase);
    }
    
    /**
     * Custom renderer to display user-friendly labels for TimeBase values.
     */
    private static class TimeBaseRenderer extends DefaultListCellRenderer {
        
        @Override
        public Component getListCellRendererComponent(
                JList<?> list,
                Object value,
                int index,
                boolean isSelected,
                boolean cellHasFocus) {
            
            JLabel label = (JLabel) super.getListCellRendererComponent(
                    list, value, index, isSelected, cellHasFocus);
            
            if (value instanceof TimeBase timeBase) {
                label.setText(getDisplayName(timeBase));
            }
            
            return label;
        }
        
        /**
         * Gets a user-friendly display name for a TimeBase.
         */
        private String getDisplayName(TimeBase timeBase) {
            return switch (timeBase) {
                case BEATS -> "Csound Beats";
                case BBT -> "BBT (Bar.Beat.Ticks)";
                case BBST -> "BBST (Bar.Beat.16th.Ticks)";
                case BBF -> "BBF (Bar.Beat.Fraction)";
                case TIME -> "Time (HH:MM:SS.mmm)";
                case SECONDS -> "Seconds (decimal)";
                case SMPTE -> "SMPTE (HH:MM:SS:FF)";
                case FRAME -> "Sample Frames";
            };
        }
    }
}
