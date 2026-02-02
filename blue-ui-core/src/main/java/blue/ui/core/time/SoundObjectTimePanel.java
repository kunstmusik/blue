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
import blue.time.TimeUnit;
import blue.time.TimeUtilities;
import java.awt.BorderLayout;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;

/**
 * Composite panel for editing TimeUnit values with TimeBase selection.
 * Combines a TimeBaseSelector with a unified TextTimeUnitEditor that handles
 * all TimeBase formats via text input.
 * 
 * @author steven yi
 */
public class SoundObjectTimePanel extends JPanel {

    private final TimeBaseSelector timeBaseSelector;
    private final TextTimeUnitEditor textEditor;

    private TimeUnit currentTimeUnit;
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
     * Gets the current TimeUnit value.
     * 
     * @return the current TimeUnit
     */
    public TimeUnit getTimeUnit() {
        return currentTimeUnit;
    }

    /**
     * Sets the TimeUnit value to edit.
     * 
     * @param timeUnit the TimeUnit to edit
     */
    public void setTimeUnit(TimeUnit timeUnit) {
        if (this.currentTimeUnit == timeUnit) {
            return;
        }

        this.currentTimeUnit = timeUnit;
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
     * Updates the display to show the current TimeUnit.
     */
    private void updateDisplay() {
        if (currentTimeUnit == null) {
            return;
        }

        // Determine TimeBase from TimeUnit type and update selector
        TimeBase timeBase = currentTimeUnit.getTimeBase();
        timeBaseSelector.setSelectedTimeBase(timeBase);

        // Update the text editor with TimeBase and value
        textEditor.setTimeBase(timeBase);
        textEditor.setTimeUnit(currentTimeUnit);
    }

    /**
     * Handles TimeBase selection changes.
     */
    private void handleTimeBaseChange() {
        TimeBase newTimeBase = timeBaseSelector.getSelectedTimeBase();
        textEditor.setTimeBase(newTimeBase);

        // Convert current TimeUnit to new TimeBase using TimeContext
        if (currentTimeUnit != null) {
            TimeUnit oldValue = currentTimeUnit;
            
            // Use project's TimeContext for proper conversion
            TimeContext context = BlueProjectManager.getInstance().getCurrentProject().getData().getScore().getTimeContext();
            TimeContext previousContext = TimeContextManager.hasContext() ? TimeContextManager.getContext() : null;
            TimeContextManager.setContext(context);

            try {
                currentTimeUnit = TimeUtilities.convertTimeUnit(oldValue, newTimeBase, context);
                textEditor.setTimeUnit(currentTimeUnit);

                // Fire property change so parent component is notified
                propertyChangeSupport.firePropertyChange("timeUnit", oldValue, currentTimeUnit);
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
     * Updates the TimeUnit from the text editor.
     */
    private void updateTimeUnitFromEditor() {
        TimeUnit oldValue = currentTimeUnit;
        currentTimeUnit = textEditor.getTimeUnit();
        
        // Fire property change within TimeContext since listeners may need it
        TimeContext context = BlueProjectManager.getInstance().getCurrentProject().getData().getScore().getTimeContext();
        TimeContext previousContext = TimeContextManager.hasContext() ? TimeContextManager.getContext() : null;
        TimeContextManager.setContext(context);

        try {
            propertyChangeSupport.firePropertyChange("timeUnit", oldValue, currentTimeUnit);
        } finally {
            if (previousContext != null) {
                TimeContextManager.setContext(previousContext);
            } else {
                TimeContextManager.clearContext();
            }
        }
    }

    /**
     * Adds a PropertyChangeListener to listen for TimeUnit changes.
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

    @Override
    public void setEnabled(boolean enabled) {
        super.setEnabled(enabled);
        setTimeBaseSelectionEnabled(enabled);
        setPositionEditingEnabled(enabled);
    }
}
