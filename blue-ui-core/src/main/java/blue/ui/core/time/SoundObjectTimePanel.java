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
import java.awt.CardLayout;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.event.ChangeListener;

/**
 * Composite panel for editing TimeUnit values with TimeBase selection.
 * Combines a TimeBaseSelector with the appropriate TimeUnitEditor based on
 * the selected TimeBase.
 * 
 * This panel automatically switches between different TimeUnit editors when
 * the TimeBase changes, and handles conversion between TimeUnit types.
 * 
 * @author steven yi
 */
public class SoundObjectTimePanel extends JPanel {

    private final TimeBaseSelector timeBaseSelector;
    private final JPanel editorPanel;
    private final CardLayout editorCardLayout;

    private final BeatTimeEditor beatTimeEditor;
    private final MeasureTimeEditor measureTimeEditor;
    private final SecondTimeEditor secondTimeEditor;
    private final SecondTimeEditor smpteTimeEditor;
    private final SampleTimeEditor sampleTimeEditor;

    private TimeUnit currentTimeUnit;
    private boolean updating = false;
    private final PropertyChangeSupport propertyChangeSupport;

    /**
     * Creates a new SoundObjectTimePanel.
     */
    public SoundObjectTimePanel() {
        propertyChangeSupport = new PropertyChangeSupport(this);
        setLayout(new BorderLayout());

        // TimeBase selector in NORTH - no label needed, context is clear
        // Exclude PROJECT_DEFAULT - properties panel shows actual TimeBase
        timeBaseSelector = new TimeBaseSelector(false);
        add(timeBaseSelector, BorderLayout.NORTH);

        // Card panel for switching between editors in CENTER
        // CENTER will fill width and grow vertically as needed
        editorCardLayout = new CardLayout();
        editorPanel = new JPanel(editorCardLayout);
        editorPanel.setBorder(new EmptyBorder(3, 0, 3, 0)); // Add this line

        // Create all editors
        beatTimeEditor = new BeatTimeEditor();
        measureTimeEditor = new MeasureTimeEditor();
        secondTimeEditor = new SecondTimeEditor();
        smpteTimeEditor = new SecondTimeEditor();
        sampleTimeEditor = new SampleTimeEditor();

        // Add editors to card panel
        editorPanel.add(beatTimeEditor, "CSOUND_BEATS");
        editorPanel.add(measureTimeEditor, "MEASURE_BEATS");
        editorPanel.add(secondTimeEditor, "TIME");
        editorPanel.add(smpteTimeEditor, "SMPTE");
        editorPanel.add(sampleTimeEditor, "FRAME");

        add(editorPanel, BorderLayout.CENTER);

        // Listen for TimeBase changes
        timeBaseSelector.addActionListener(e -> {
            if (!updating) {
                handleTimeBaseChange();
            }
        });

        // Listen for editor changes
        ChangeListener editorChangeListener = e -> {
            if (!updating) {
                updateTimeUnitFromEditor();
            }
        };

        beatTimeEditor.addChangeListener(editorChangeListener);
        measureTimeEditor.addChangeListener(editorChangeListener);
        secondTimeEditor.addChangeListener(editorChangeListener);
        smpteTimeEditor.addChangeListener(editorChangeListener);
        sampleTimeEditor.addChangeListener(editorChangeListener);
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

        // Determine TimeBase from TimeUnit type
        TimeBase timeBase = currentTimeUnit.getTimeBase();
        timeBaseSelector.setSelectedTimeBase(timeBase);

        // Show appropriate editor
        showEditorForTimeBase(timeBase);

        // Update the editor with the current value
        TimeUnitEditor editor = getEditorForTimeBase(timeBase);
        if (editor != null) {
            editor.setTimeUnit(currentTimeUnit);
        }
    }

    /**
     * Handles TimeBase selection changes.
     */
    private void handleTimeBaseChange() {
        TimeBase newTimeBase = timeBaseSelector.getSelectedTimeBase();
        showEditorForTimeBase(newTimeBase);

        // Convert current TimeUnit to new TimeBase using TimeContext
        if (currentTimeUnit != null) {
            TimeUnit oldValue = currentTimeUnit;
            
            // Use project's TimeContext for proper conversion with meter, tempo, and sample rate
            // Get the current project's TimeContext
            TimeContext context = BlueProjectManager.getInstance().getCurrentProject().getData().getScore().getTimeContext();
            TimeContext previousContext = TimeContextManager.hasContext() ? TimeContextManager.getContext() : null;
            TimeContextManager.setContext(context);

            try {
                currentTimeUnit = TimeUtilities.convertTimeUnit(oldValue, newTimeBase, context);

                TimeUnitEditor editor = getEditorForTimeBase(newTimeBase);
                if (editor != null) {
                    editor.setTimeUnit(currentTimeUnit);
                }

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
     * Updates the TimeUnit from the current editor.
     */
    private void updateTimeUnitFromEditor() {
        TimeBase timeBase = timeBaseSelector.getSelectedTimeBase();
        TimeUnitEditor editor = getEditorForTimeBase(timeBase);
        if (editor != null) {
            TimeUnit oldValue = currentTimeUnit;
            currentTimeUnit = editor.getTimeUnit();
            
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
    }

    /**
     * Shows the appropriate editor for the given TimeBase.
     */
    private void showEditorForTimeBase(TimeBase timeBase) {
        editorCardLayout.show(editorPanel, timeBase.name());
    }

    /**
     * Gets the editor for the given TimeBase.
     */
    private TimeUnitEditor getEditorForTimeBase(TimeBase timeBase) {
        return switch (timeBase) {
            case CSOUND_BEATS -> beatTimeEditor;
            case MEASURE_BEATS -> measureTimeEditor;
            case TIME -> secondTimeEditor;
            case SMPTE -> smpteTimeEditor;
            case FRAME -> sampleTimeEditor;
            case PROJECT_DEFAULT -> null;
        };
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
        timeBaseSelector.setEnabled(enabled);
        beatTimeEditor.setEnabled(enabled);
        measureTimeEditor.setEnabled(enabled);
        secondTimeEditor.setEnabled(enabled);
        smpteTimeEditor.setEnabled(enabled);
        sampleTimeEditor.setEnabled(enabled);
    }
}
