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

import blue.projects.BlueProjectManager;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;
import java.awt.BorderLayout;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;

/**
 * Composite panel for editing TimePosition values with TimeBase selection.
 * Combines a TimeBaseSelector with a unified TextTimeUnitEditor that handles
 * all TimeBase formats via text input.
 * 
 * @author steven yi
 */
public class SoundObjectTimePanel extends JPanel {

    private final TimeBaseSelector timeBaseSelector;
    private final TextTimeUnitEditor textEditor;

    private TimePosition currentTimePosition;
    private boolean updating = false;
    private final PropertyChangeSupport propertyChangeSupport;

    /**
     * Creates a new SoundObjectTimePanel.
     */
    public SoundObjectTimePanel() {
        propertyChangeSupport = new PropertyChangeSupport(this);
        setLayout(new BorderLayout());

        // TimeBase selector in NORTH
        timeBaseSelector = new TimeBaseSelector();
        add(timeBaseSelector, BorderLayout.NORTH);

        // Unified text editor for all formats
        textEditor = new TextTimeUnitEditor();
        textEditor.setTimeContextSupplier(this::getTimeContext);
        JPanel editorWrapper = new JPanel(new BorderLayout());
        editorWrapper.setBorder(new EmptyBorder(3, 0, 3, 0));
        editorWrapper.add(textEditor, BorderLayout.CENTER);
        add(editorWrapper, BorderLayout.CENTER);

        // Listen for TimeBase changes
        timeBaseSelector.addActionListener(e -> {
            if (!updating) {
                handleTimeBaseChange();
            }
        });

        // Listen for editor changes
        textEditor.addChangeListener(e -> {
            if (!updating) {
                updateTimeUnitFromEditor();
            }
        });
    }

    public void setTimeBaseSelectionEnabled(boolean enabled) {
        timeBaseSelector.setEnabled(enabled);
    }

    public void setPositionEditingEnabled(boolean enabled) {
        textEditor.setEnabled(enabled);
    }

    /**
     * Gets the current TimePosition value.
     * 
     * @return the current TimePosition
     */
    public TimePosition getTimePosition() {
        return currentTimePosition;
    }

    /**
     * Sets the TimePosition value to edit.
     * 
     * @param timePosition the TimePosition to edit
     */
    public void setTimePosition(TimePosition timePosition) {
        if (this.currentTimePosition == timePosition) {
            return;
        }

        this.currentTimePosition = timePosition;
        updating = true;
        try {
            updateDisplay();
        } finally {
            updating = false;
        }
    }

    /**
     * Gets the currently selected TimeBase.
     * 
     * @return the selected TimeBase
     */
    public TimeBase getTimeBase() {
        return timeBaseSelector.getSelectedTimeBase();
    }

    /**
     * Sets the TimeBase.
     * 
     * @param timeBase the TimeBase to select
     */
    public void setTimeBase(TimeBase timeBase) {
        timeBaseSelector.setSelectedTimeBase(timeBase);
    }

    /**
     * Updates the display to show the current TimePosition.
     */
    private void updateDisplay() {
        if (currentTimePosition == null) {
            return;
        }

        // Determine TimeBase from TimePosition type and update selector
        TimeBase timeBase = currentTimePosition.getTimeBase();
        timeBaseSelector.setSelectedTimeBase(timeBase);

        // Update the text editor with TimeBase and value
        textEditor.setTimeBase(timeBase);
        textEditor.setTimePosition(currentTimePosition);
    }

    /**
     * Handles TimeBase selection changes.
     */
    private void handleTimeBaseChange() {
        TimeBase newTimeBase = timeBaseSelector.getSelectedTimeBase();
        textEditor.setTimeBase(newTimeBase);

        // Convert current TimePosition to new TimeBase using TimeContext
        if (currentTimePosition != null) {
            TimePosition oldValue = currentTimePosition;
            
            // Use project's TimeContext for proper conversion
            TimeContext context = getTimeContext();
            if (context == null) {
                return;
            }
            TimeContext previousContext = TimeContextManager.hasContext() ? TimeContextManager.getContext() : null;
            TimeContextManager.setContext(context);

            try {
                currentTimePosition = TimeUtilities.convertTimePosition(oldValue, newTimeBase, context);
                textEditor.setTimePosition(currentTimePosition);

                // Fire property change so parent component is notified
                propertyChangeSupport.firePropertyChange("timePosition", oldValue, currentTimePosition);
            } finally {
                if (previousContext != null) {
                    TimeContextManager.setContext(previousContext);
                } else {
                    TimeContextManager.clearContext();
                }
            }
        }
    }

    /**
     * Updates the TimePosition from the text editor.
     */
    private void updateTimeUnitFromEditor() {
        TimePosition oldValue = currentTimePosition;
        currentTimePosition = textEditor.getTimePosition();
        
        // Fire property change within TimeContext since listeners may need it
        TimeContext context = getTimeContext();
        if (context == null) {
            propertyChangeSupport.firePropertyChange("timePosition", oldValue, currentTimePosition);
            return;
        }
        TimeContext previousContext = TimeContextManager.hasContext() ? TimeContextManager.getContext() : null;
        TimeContextManager.setContext(context);

        try {
            propertyChangeSupport.firePropertyChange("timePosition", oldValue, currentTimePosition);
        } finally {
            if (previousContext != null) {
                TimeContextManager.setContext(previousContext);
            } else {
                TimeContextManager.clearContext();
            }
        }
    }

    /**
     * Adds a PropertyChangeListener to listen for TimePosition changes.
     */
    @Override
    public void addPropertyChangeListener(String propertyName, PropertyChangeListener listener) {
        propertyChangeSupport.addPropertyChangeListener(propertyName, listener);
    }

    /**
     * Removes a PropertyChangeListener.
     */
    @Override
    public void removePropertyChangeListener(String propertyName, PropertyChangeListener listener) {
        propertyChangeSupport.removePropertyChangeListener(propertyName, listener);
    }

    /**
     * Sets a TimeDuration value to edit.
     * Converts the TimeDuration to an equivalent TimePosition for internal storage.
     * 
     * @param duration the TimeDuration to edit
     */
    public void setTimeDuration(TimeDuration duration) {
        if (duration == null) {
            return;
        }
        TimeContext context = getTimeContext();
        if (context == null) {
            return;
        }
        setTimePosition(TimeUtilities.beatsToTimePosition(duration.toBeats(context), duration.getTimeBase(), context));
    }

    /**
     * Gets the current value as a TimeDuration.
     * Converts the internal TimePosition to a TimeDuration.
     * 
     * @return the current value as a TimeDuration, or null if no value is set
     */
    public TimeDuration getTimeDuration() {
        TimePosition tu = getTimePosition();
        if (tu == null) {
            return null;
        }
        TimeContext context = getTimeContext();
        if (context == null) {
            return null;
        }
        return TimeUnitMath.beatsToDuration(tu.toBeats(context), tu.getTimeBase(), context);
    }

    /**
     * Sets duration mode for 0-based measure display on this panel.
     * When enabled, BBT/BBST/BBF formats display and parse as durations (0-based bars/beats).
     */
    public void setDurationMode(boolean durationMode) {
        textEditor.setDurationMode(durationMode);
    }

    private TimeContext getTimeContext() {
        var currentProject = BlueProjectManager.getInstance().getCurrentProject();
        if (currentProject == null || currentProject.getData() == null) {
            return null;
        }
        return currentProject.getData().getScore().getTimeContext();
    }

    @Override
    public void setEnabled(boolean enabled) {
        super.setEnabled(enabled);
        setTimeBaseSelectionEnabled(enabled);
        setPositionEditingEnabled(enabled);
    }
}
