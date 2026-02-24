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
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Frame;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.EnumMap;
import java.util.Map;
import javax.swing.BorderFactory;
import javax.swing.ButtonGroup;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRadioButton;

/**
 * Modal dialog for configuring ruler display settings.
 * Allows setting primary/secondary ruler TimeBase and SMPTE frame rate.
 *
 * @author Steven Yi
 */
public class RulerConfigDialog extends JDialog {

    public enum TimebaseUpdateMode {
        UPDATE_ALL,
        UPDATE_MATCHING
    }

    private static final double[] SMPTE_FRAME_RATES = {
        23.976, 24.0, 25.0, 29.97, 30.0, 50.0, 59.94, 60.0
    };
    
    private static final String[] SMPTE_FRAME_RATE_LABELS = {
        "23.976 fps", "24 fps", "25 fps", "29.97 fps (drop)", 
        "30 fps", "50 fps", "59.94 fps", "60 fps"
    };

    private final JComboBox<TimeDisplayFormat> primaryFormatCombo;
    private final JCheckBox secondaryEnabledCheck;
    private final JComboBox<TimeDisplayFormat> secondaryFormatCombo;
    private final JComboBox<String> smpteFrameRateCombo;
    
    private final JCheckBox updateScoreObjectsCheck;
    private final Map<TimebaseUpdateMode, JRadioButton> scoreObjectModeRadios;
    private final ButtonGroup scoreObjectModeGroup;
    
    private final JCheckBox updateMarkersCheck;
    private final Map<TimebaseUpdateMode, JRadioButton> markerModeRadios;
    private final ButtonGroup markerModeGroup;
    
    private TimeState timeState;
    private boolean confirmed = false;

    public RulerConfigDialog(Frame owner) {
        super(owner, "Ruler Configuration", true);
        
        primaryFormatCombo = new JComboBox<>(new DefaultComboBoxModel<>(TimeDisplayFormat.values()));
        secondaryEnabledCheck = new JCheckBox("Enabled");
        secondaryFormatCombo = new JComboBox<>(new DefaultComboBoxModel<>(TimeDisplayFormat.values()));
        smpteFrameRateCombo = new JComboBox<>(SMPTE_FRAME_RATE_LABELS);
        
        // ScoreObject update group
        updateScoreObjectsCheck = new JCheckBox("Update ScoreObjects");
        updateScoreObjectsCheck.setSelected(true);
        scoreObjectModeRadios = createModeRadios("Update All TimeBases", "Update Matching TimeBases");
        scoreObjectModeGroup = new ButtonGroup();
        scoreObjectModeRadios.values().forEach(scoreObjectModeGroup::add);
        updateScoreObjectsCheck.addActionListener(e -> {
            boolean enabled = updateScoreObjectsCheck.isSelected();
            scoreObjectModeRadios.values().forEach(r -> r.setEnabled(enabled));
        });
        
        // Marker update group
        updateMarkersCheck = new JCheckBox("Update Markers");
        updateMarkersCheck.setSelected(true);
        markerModeRadios = createModeRadios("Update All TimeBases", "Update Matching TimeBases");
        markerModeGroup = new ButtonGroup();
        markerModeRadios.values().forEach(markerModeGroup::add);
        updateMarkersCheck.addActionListener(e -> {
            boolean enabled = updateMarkersCheck.isSelected();
            markerModeRadios.values().forEach(r -> r.setEnabled(enabled));
        });
        
        initComponents();
        pack();
        setLocationRelativeTo(owner);
    }
    
    private void initComponents() {
        JPanel mainPanel = new JPanel(new GridBagLayout());
        mainPanel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        
        // Primary Ruler section
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.gridwidth = 2;
        JLabel primaryLabel = new JLabel("Primary Ruler");
        primaryLabel.setFont(primaryLabel.getFont().deriveFont(java.awt.Font.BOLD));
        mainPanel.add(primaryLabel, gbc);
        
        gbc.gridy = 1;
        gbc.gridwidth = 1;
        mainPanel.add(new JLabel("Format:"), gbc);
        
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        mainPanel.add(primaryFormatCombo, gbc);
        
        // ScoreObject Timebase Update options
        gbc.gridx = 0;
        gbc.gridy = 2;
        gbc.gridwidth = 2;
        gbc.weightx = 0;
        gbc.insets = new Insets(10, 10, 2, 5);
        mainPanel.add(updateScoreObjectsCheck, gbc);
        
        gbc.gridy = 3;
        gbc.insets = new Insets(2, 30, 2, 5);
        mainPanel.add(scoreObjectModeRadios.get(TimebaseUpdateMode.UPDATE_ALL), gbc);
        
        gbc.gridy = 4;
        gbc.insets = new Insets(2, 30, 2, 5);
        mainPanel.add(scoreObjectModeRadios.get(TimebaseUpdateMode.UPDATE_MATCHING), gbc);
        
        // Marker Timebase Update options
        gbc.gridy = 5;
        gbc.insets = new Insets(10, 10, 2, 5);
        mainPanel.add(updateMarkersCheck, gbc);
        
        gbc.gridy = 6;
        gbc.insets = new Insets(2, 30, 2, 5);
        mainPanel.add(markerModeRadios.get(TimebaseUpdateMode.UPDATE_ALL), gbc);
        
        gbc.gridy = 7;
        gbc.insets = new Insets(2, 30, 5, 5);
        mainPanel.add(markerModeRadios.get(TimebaseUpdateMode.UPDATE_MATCHING), gbc);
        
        // Secondary Ruler section
        gbc.gridx = 0;
        gbc.gridy = 8;
        gbc.gridwidth = 2;
        gbc.weightx = 0;
        gbc.insets = new Insets(15, 5, 5, 5);
        JLabel secondaryLabel = new JLabel("Secondary Ruler");
        secondaryLabel.setFont(secondaryLabel.getFont().deriveFont(java.awt.Font.BOLD));
        mainPanel.add(secondaryLabel, gbc);
        
        gbc.gridy = 9;
        gbc.insets = new Insets(5, 5, 5, 5);
        mainPanel.add(secondaryEnabledCheck, gbc);
        
        gbc.gridy = 10;
        gbc.gridwidth = 1;
        mainPanel.add(new JLabel("Format:"), gbc);
        
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        mainPanel.add(secondaryFormatCombo, gbc);
        
        // SMPTE Settings section
        gbc.gridx = 0;
        gbc.gridy = 11;
        gbc.gridwidth = 2;
        gbc.weightx = 0;
        gbc.insets = new Insets(15, 5, 5, 5);
        JLabel smpteLabel = new JLabel("SMPTE Settings");
        smpteLabel.setFont(smpteLabel.getFont().deriveFont(java.awt.Font.BOLD));
        mainPanel.add(smpteLabel, gbc);
        
        gbc.gridy = 12;
        gbc.gridwidth = 1;
        gbc.insets = new Insets(5, 5, 5, 5);
        mainPanel.add(new JLabel("Frame Rate:"), gbc);
        
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        mainPanel.add(smpteFrameRateCombo, gbc);
        
        // Button panel
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttonPanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 10, 10));
        JButton cancelButton = new JButton("Cancel");
        JButton okButton = new JButton("OK");
        
        cancelButton.addActionListener(e -> {
            confirmed = false;
            setVisible(false);
        });
        
        okButton.addActionListener(e -> {
            confirmed = true;
            applyToTimeState();
            setVisible(false);
        });
        
        buttonPanel.add(cancelButton);
        buttonPanel.add(okButton);
        
        // Secondary enabled checkbox listener
        secondaryEnabledCheck.addActionListener(e -> {
            secondaryFormatCombo.setEnabled(secondaryEnabledCheck.isSelected());
        });
        
        // Layout
        setLayout(new BorderLayout());
        add(mainPanel, BorderLayout.CENTER);
        add(buttonPanel, BorderLayout.SOUTH);
        
        getRootPane().setDefaultButton(okButton);
    }
    
    /**
     * Sets the TimeState to configure.
     */
    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
        loadFromTimeState();
    }
    
    private void loadFromTimeState() {
        if (timeState == null) return;
        
        // Primary ruler
        TimeDisplayFormat primaryFormat = TimeDisplayFormat.fromTimeBase(timeState.getTimeDisplay());
        primaryFormatCombo.setSelectedItem(primaryFormat);
        
        // Secondary ruler
        secondaryEnabledCheck.setSelected(timeState.isSecondaryRulerEnabled());
        secondaryFormatCombo.setEnabled(timeState.isSecondaryRulerEnabled());
        TimeDisplayFormat secondaryFormat = TimeDisplayFormat.fromTimeBase(timeState.getSecondaryTimeDisplay());
        secondaryFormatCombo.setSelectedItem(secondaryFormat);
        
        // SMPTE frame rate
        double frameRate = timeState.getSmpteFrameRate();
        int frameRateIndex = findClosestFrameRateIndex(frameRate);
        smpteFrameRateCombo.setSelectedIndex(frameRateIndex);
    }
    
    private void applyToTimeState() {
        if (timeState == null) return;
        
        // Primary ruler
        TimeDisplayFormat primaryFormat = (TimeDisplayFormat) primaryFormatCombo.getSelectedItem();
        if (primaryFormat != null) {
            timeState.setTimeDisplay(primaryFormat.getTimeBase());
        }
        
        // Secondary ruler
        timeState.setSecondaryRulerEnabled(secondaryEnabledCheck.isSelected());
        TimeDisplayFormat secondaryFormat = (TimeDisplayFormat) secondaryFormatCombo.getSelectedItem();
        if (secondaryFormat != null) {
            timeState.setSecondaryTimeDisplay(secondaryFormat.getTimeBase());
        }
        
        // SMPTE frame rate
        int frameRateIndex = smpteFrameRateCombo.getSelectedIndex();
        if (frameRateIndex >= 0 && frameRateIndex < SMPTE_FRAME_RATES.length) {
            timeState.setSmpteFrameRate(SMPTE_FRAME_RATES[frameRateIndex]);
        }
    }
    
    private int findClosestFrameRateIndex(double frameRate) {
        int closestIndex = 0;
        double closestDiff = Math.abs(SMPTE_FRAME_RATES[0] - frameRate);
        
        for (int i = 1; i < SMPTE_FRAME_RATES.length; i++) {
            double diff = Math.abs(SMPTE_FRAME_RATES[i] - frameRate);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = i;
            }
        }
        
        return closestIndex;
    }
    
    /**
     * Returns the ScoreObject update mode, or null if ScoreObjects should not be updated.
     */
    public TimebaseUpdateMode getScoreObjectUpdateMode() {
        if (!updateScoreObjectsCheck.isSelected()) {
            return null;
        }
        return getSelectedMode(scoreObjectModeRadios);
    }
    
    /**
     * Returns the Marker update mode, or null if markers should not be updated.
     */
    public TimebaseUpdateMode getMarkerUpdateMode() {
        if (!updateMarkersCheck.isSelected()) {
            return null;
        }
        return getSelectedMode(markerModeRadios);
    }
    
    private TimebaseUpdateMode getSelectedMode(Map<TimebaseUpdateMode, JRadioButton> radios) {
        for (var entry : radios.entrySet()) {
            if (entry.getValue().isSelected()) {
                return entry.getKey();
            }
        }
        return TimebaseUpdateMode.UPDATE_ALL;
    }
    
    private static Map<TimebaseUpdateMode, JRadioButton> createModeRadios(
            String allLabel, String matchingLabel) {
        Map<TimebaseUpdateMode, JRadioButton> radios = new EnumMap<>(TimebaseUpdateMode.class);
        radios.put(TimebaseUpdateMode.UPDATE_ALL, new JRadioButton(allLabel));
        radios.put(TimebaseUpdateMode.UPDATE_MATCHING, new JRadioButton(matchingLabel));
        radios.get(TimebaseUpdateMode.UPDATE_ALL).setSelected(true);
        return radios;
    }
    
    /**
     * Returns true if the user clicked OK.
     */
    public boolean isConfirmed() {
        return confirmed;
    }
    
    /**
     * Shows the dialog and returns true if the user confirmed changes.
     */
    public boolean showDialog() {
        confirmed = false;
        updateScoreObjectsCheck.setSelected(true);
        scoreObjectModeRadios.get(TimebaseUpdateMode.UPDATE_ALL).setSelected(true);
        scoreObjectModeRadios.values().forEach(r -> r.setEnabled(true));
        updateMarkersCheck.setSelected(true);
        markerModeRadios.get(TimebaseUpdateMode.UPDATE_ALL).setSelected(true);
        markerModeRadios.values().forEach(r -> r.setEnabled(true));
        setVisible(true);
        return confirmed;
    }
}
