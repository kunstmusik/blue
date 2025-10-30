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
import javax.swing.JPanel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.EventListenerList;

/**
 * Abstract base class for TimeUnit editor components. Provides a common
 * interface for editing different TimeUnit types (BeatTime, MeasureTime, etc.)
 * in Swing.
 * 
 * Subclasses should:
 * 1. Create appropriate UI controls in their constructor
 * 2. Implement updateDisplay() to show the current TimeUnit value
 * 3. Implement updateModel() to create a new TimeUnit from UI values
 * 4. Call fireStateChanged() when the user modifies values
 * 
 * @author steven yi
 */
public abstract class TimeUnitEditor extends JPanel {
    
    private TimeUnit timeUnit;
    private boolean updating = false;
    protected EventListenerList listenerList = new EventListenerList();
    
    /**
     * Creates a new TimeUnitEditor.
     */
    public TimeUnitEditor() {
        super();
    }
    
    /**
     * Gets the current TimeUnit value.
     * 
     * @return the current TimeUnit, or null if not set
     */
    public TimeUnit getTimeUnit() {
        return timeUnit;
    }
    
    /**
     * Sets the TimeUnit value to edit. This will update the UI display.
     * 
     * @param timeUnit the TimeUnit to edit
     */
    public void setTimeUnit(TimeUnit timeUnit) {
        if (this.timeUnit == timeUnit) {
            return;
        }
        
        this.timeUnit = timeUnit;
        updating = true;
        try {
            updateDisplay();
        } finally {
            updating = false;
        }
    }
    
    /**
     * Checks if the editor is currently updating from a setTimeUnit() call.
     * Subclasses can use this to avoid firing change events during updates.
     * 
     * @return true if currently updating from external source
     */
    protected boolean isUpdating() {
        return updating;
    }
    
    /**
     * Updates the UI display to reflect the current TimeUnit value.
     * Called automatically when setTimeUnit() is called.
     * 
     * Subclasses should override this to update their UI controls.
     */
    protected abstract void updateDisplay();
    
    /**
     * Creates a new TimeUnit from the current UI values.
     * Called when the UI values change.
     * 
     * Subclasses should override this to create the appropriate TimeUnit
     * from their UI control values.
     * 
     * @return a new TimeUnit representing the current UI state
     */
    protected abstract TimeUnit updateModel();
    
    /**
     * Notifies listeners that the TimeUnit value has changed.
     * Subclasses should call this when the user modifies UI values.
     */
    protected void fireStateChanged() {
        if (updating) {
            return;
        }
        
        // Update the model
        timeUnit = updateModel();
        
        // Notify listeners
        ChangeEvent event = new ChangeEvent(this);
        for (ChangeListener listener : listenerList.getListeners(ChangeListener.class)) {
            listener.stateChanged(event);
        }
    }
    
    /**
     * Adds a ChangeListener to be notified when the TimeUnit value changes.
     * 
     * @param listener the listener to add
     */
    public void addChangeListener(ChangeListener listener) {
        listenerList.add(ChangeListener.class, listener);
    }
    
    /**
     * Removes a ChangeListener.
     * 
     * @param listener the listener to remove
     */
    public void removeChangeListener(ChangeListener listener) {
        listenerList.remove(ChangeListener.class, listener);
    }
    
    /**
     * Enables or disables the editor.
     * 
     * @param enabled true to enable, false to disable
     */
    @Override
    public void setEnabled(boolean enabled) {
        super.setEnabled(enabled);
        enableComponents(enabled);
    }
    
    /**
     * Enables or disables the editor's child components.
     * Subclasses should override this to enable/disable their UI controls.
     * 
     * @param enabled true to enable, false to disable
     */
    protected abstract void enableComponents(boolean enabled);
}
