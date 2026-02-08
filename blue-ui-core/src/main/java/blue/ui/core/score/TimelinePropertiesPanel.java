/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

import blue.BlueSystem;
import blue.score.TimeState;
import blue.time.TimeBase;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeListener;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.ButtonGroup;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.JTextField;

/**
 * @deprecated Replaced by {@link SnapButton} and {@link RulerConfigDialog}.
 * This class will be removed in a future release.
 */
@Deprecated
class TimelinePropertiesPanel extends JComponent {

    JCheckBox snapEnabledBox = new JCheckBox(BlueSystem
            .getString("scoreGUI.snapEnabled"));

    JTextField snapValue = new JTextField();

    JRadioButton timeDisplayTime = new JRadioButton(BlueSystem
            .getString("scoreGUI.timeline.time"));

    JRadioButton timeDisplayBeats = new JRadioButton("Beats");

    JCheckBox secondaryRulerEnabled = new JCheckBox("Show Secondary Ruler");
    
    // Use plain JComboBox instead of TimeFormatSelector to avoid binding to primary timeDisplay
    JComboBox<TimeDisplayFormat> secondaryFormatSelector = new JComboBox<>(
            new DefaultComboBoxModel<>(TimeDisplayFormat.values()));

    boolean isUpdating = false;

    TimeState timeState;
    
    PropertyChangeListener pcl;

    public TimelinePropertiesPanel() {

        snapEnabledBox.addActionListener((ActionEvent e) -> {
            if (timeState != null) {
                timeState.setSnapEnabled(snapEnabledBox.isSelected());
            }
        });

        snapValue.addActionListener((ActionEvent e) -> {
            if (timeState == null || isUpdating) {
                return;
            }
            isUpdating = true;
            
            try {
                double val = Double.parseDouble(snapValue.getText());
                if (val < 0) {
                    return;
                }
                timeState.setSnapValue(val);
            } catch (NumberFormatException nfe) {
                snapValue.setText(Double.toString(timeState.getSnapValue()));
            }

            isUpdating = false;
        });

        ActionListener timeActionListener = (ActionEvent e) -> {
            if (!isUpdating) {
                if (e.getSource() == timeDisplayTime) {
                    timeState.setTimeDisplay(TimeBase.TIME);
                } else if (e.getSource() == timeDisplayBeats) {
                    timeState.setTimeDisplay(TimeBase.CSOUND_BEATS);
                }
            }
        };
        
        pcl = pce -> {
            if (isUpdating) return;
            isUpdating = true;
            try {
                switch (pce.getPropertyName()) {
                    case "snapEnabled" -> snapEnabledBox.setSelected((boolean) pce.getNewValue());
                    case "timeDisplay" -> {
                        TimeBase newTimeBase = (TimeBase) pce.getNewValue();
                        if (newTimeBase == TimeBase.TIME) {
                            timeDisplayTime.setSelected(true);
                        } else {
                            timeDisplayBeats.setSelected(true);
                        }
                    }
                    case "secondaryRulerEnabled" -> {
                        secondaryRulerEnabled.setSelected((boolean) pce.getNewValue());
                        secondaryFormatSelector.setEnabled((boolean) pce.getNewValue());
                    }
                    case "secondaryTimeDisplay" -> {
                        TimeDisplayFormat format = TimeDisplayFormat.fromTimeBase((TimeBase) pce.getNewValue());
                        secondaryFormatSelector.setSelectedItem(format);
                    }
                }
            } finally {
                isUpdating = false;
            }
        };
        
        // Secondary ruler controls
        secondaryRulerEnabled.addActionListener((ActionEvent e) -> {
            if (timeState != null && !isUpdating) {
                timeState.setSecondaryRulerEnabled(secondaryRulerEnabled.isSelected());
                secondaryFormatSelector.setEnabled(secondaryRulerEnabled.isSelected());
            }
        });
        
        secondaryFormatSelector.addActionListener(evt -> {
            if (timeState != null && !isUpdating) {
                TimeDisplayFormat format = (TimeDisplayFormat) secondaryFormatSelector.getSelectedItem();
                if (format != null) {
                    timeState.setSecondaryTimeDisplay(format.getTimeBase());
                }
            }
        });
        secondaryFormatSelector.setEnabled(false);

        timeDisplayTime.addActionListener(timeActionListener);
        timeDisplayBeats.addActionListener(timeActionListener);

        ButtonGroup bg = new ButtonGroup();
        bg.add(timeDisplayTime);
        bg.add(timeDisplayBeats);


        // SET UP MENU

        this.setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        JPanel snapPanel = new JPanel();
        snapPanel.setBorder(BorderFactory.createTitledBorder(BlueSystem
                .getString("scoreGUI.snap")));
        snapPanel.setLayout(new GridLayout(2, 1));
        snapPanel.setMaximumSize(new Dimension(150, 150));

        snapPanel.add(snapEnabledBox);
        snapPanel.add(snapValue);

        JPanel timeDisplayPanel = new JPanel();
        timeDisplayPanel.setBorder(BorderFactory.createTitledBorder(BlueSystem
                .getString("scoreGUI.timeline.timeDisplay")));
        timeDisplayPanel.setLayout(new GridLayout(3, 1));
        timeDisplayPanel.setMaximumSize(new Dimension(150, 200));
        timeDisplayPanel.add(timeDisplayTime);
        timeDisplayPanel.add(timeDisplayBeats);
        
        JPanel secondaryRulerPanel = new JPanel();
        secondaryRulerPanel.setBorder(BorderFactory.createTitledBorder("Secondary Ruler"));
        secondaryRulerPanel.setLayout(new GridLayout(2, 1));
        secondaryRulerPanel.setMaximumSize(new Dimension(150, 100));
        secondaryRulerPanel.add(secondaryRulerEnabled);
        secondaryRulerPanel.add(secondaryFormatSelector);

        this.add(snapPanel);
        this.add(timeDisplayPanel);
        this.add(secondaryRulerPanel);

        this.add(Box.createVerticalGlue());

    }

    public void setTimeState(TimeState timeState) {
        isUpdating = true;
        
        if(this.timeState != null) {
            this.timeState.removePropertyChangeListener(pcl);
        }

        this.timeState = timeState;

        snapEnabledBox.setSelected(timeState.isSnapEnabled());
        snapValue.setText(Double.toString(timeState.getSnapValue()));

        if (timeState.getTimeDisplay() == TimeBase.TIME) {
            timeDisplayTime.setSelected(true);
        } else {
            timeDisplayBeats.setSelected(true);
        }
        
        // Secondary ruler state
        secondaryRulerEnabled.setSelected(timeState.isSecondaryRulerEnabled());
        secondaryFormatSelector.setEnabled(timeState.isSecondaryRulerEnabled());
        TimeDisplayFormat secondaryFormat = TimeDisplayFormat.fromTimeBase(
                timeState.getSecondaryTimeDisplay());
        secondaryFormatSelector.setSelectedItem(secondaryFormat);
        
        timeState.addPropertyChangeListener(pcl);

        isUpdating = false;
    }

}