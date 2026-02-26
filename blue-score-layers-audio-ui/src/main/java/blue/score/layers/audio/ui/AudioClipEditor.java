/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.score.layers.audio.ui;

import blue.BlueSystem;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.FadeType;
import blue.soundObject.editor.ScoreObjectEditor;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import blue.time.TimeUnitMath;
import blue.ui.core.time.SoundObjectTimePanel;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.beans.PropertyChangeListener;
import javax.swing.BorderFactory;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextField;

/**
 *
 * @author Steven Yi
 */
@ScoreObjectEditorPlugin(scoreObjectType = AudioClip.class)
public class AudioClipEditor extends ScoreObjectEditor {

    AudioClip clip;

    volatile boolean isUpdating = false;

    private final PropertyChangeListener cl;

    // Top-level fields
    private final JTextField audioFileNameTextField;
    private final SoundObjectTimePanel startTimePanel;
    private final SoundObjectTimePanel durationPanel;

    // File Properties panel
    private final JTextField fileStartTextField;
    private final JTextField fileDurationTextField;
    private final JTextField fadeInTextField;
    private final JComboBox<FadeType> fadeInTypeComboBox;
    private final JTextField fadeOutTextField;
    private final JComboBox<FadeType> fadeOutTypeComboBox;
    private final JCheckBox loopingCheckbox;

    /**
     * Creates new form AudioClipEditor
     */
    public AudioClipEditor() {
        // Create components
        audioFileNameTextField = new JTextField();
        audioFileNameTextField.setEnabled(false);

        startTimePanel = new SoundObjectTimePanel();
        durationPanel = new SoundObjectTimePanel();
        durationPanel.setDurationMode(true);

        fileStartTextField = new JTextField();
        fileStartTextField.setToolTipText("File start offset (H:MM:SS.mmm)");
        fileDurationTextField = new JTextField();
        fileDurationTextField.setEnabled(false);
        fileDurationTextField.setToolTipText("Total audio file duration");

        fadeInTextField = new JTextField();
        fadeInTextField.setToolTipText("Fade in time in seconds");
        fadeOutTextField = new JTextField();
        fadeOutTextField.setToolTipText("Fade out time in seconds");

        fadeInTypeComboBox = new JComboBox<>(new DefaultComboBoxModel<>(FadeType.values()));
        fadeOutTypeComboBox = new JComboBox<>(new DefaultComboBoxModel<>(FadeType.values()));

        loopingCheckbox = new JCheckBox();

        initLayout();
        initListeners();

        cl = evt -> {
            if (clip == null || isUpdating) {
                return;
            }

            switch (evt.getPropertyName()) {
                case AudioClip.START_TIME:
                    startTimePanel.setTimePosition(clip.getStartTime());
                    break;
                case AudioClip.DURATION:
                    durationPanel.setTimeDuration(clip.getSubjectiveDuration());
                    break;
                case AudioClip.FILE_START_TIME:
                    fileStartTextField.setText(
                            formatSecondsAsTime((Double) evt.getNewValue()));
                    break;
                case AudioClip.FADE_IN:
                    fadeInTextField.setText(
                            formatSecondsAsTime((Double) evt.getNewValue()));
                    break;
                case AudioClip.FADE_IN_TYPE:
                    fadeInTypeComboBox.setSelectedItem(evt.getNewValue());
                    break;
                case AudioClip.FADE_OUT:
                    fadeOutTextField.setText(
                            formatSecondsAsTime((Double) evt.getNewValue()));
                    break;
                case AudioClip.FADE_OUT_TYPE:
                    fadeOutTypeComboBox.setSelectedItem(evt.getNewValue());
                    break;
            }
        };
    }

    private void initLayout() {
        // Main content panel with GridBagLayout
        JPanel contentPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(3, 6, 3, 6);
        gbc.anchor = GridBagConstraints.WEST;

        int row = 0;

        // Audio File
        gbc.gridx = 0; gbc.gridy = row;
        gbc.fill = GridBagConstraints.NONE;
        gbc.weightx = 0;
        contentPanel.add(new JLabel("Audio File"), gbc);
        gbc.gridx = 1; gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.weightx = 1.0;
        contentPanel.add(audioFileNameTextField, gbc);

        // Start Time
        row++;
        gbc.gridx = 0; gbc.gridy = row;
        gbc.fill = GridBagConstraints.NONE;
        gbc.weightx = 0;
        contentPanel.add(new JLabel("Start Time"), gbc);
        gbc.gridx = 1; gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.weightx = 1.0;
        contentPanel.add(startTimePanel, gbc);

        // Duration
        row++;
        gbc.gridx = 0; gbc.gridy = row;
        gbc.fill = GridBagConstraints.NONE;
        gbc.weightx = 0;
        contentPanel.add(new JLabel("Duration"), gbc);
        gbc.gridx = 1; gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.weightx = 1.0;
        contentPanel.add(durationPanel, gbc);

        // File Properties panel
        JPanel filePropsPanel = new JPanel(new GridBagLayout());
        filePropsPanel.setBorder(BorderFactory.createTitledBorder("File Properties"));
        GridBagConstraints fgbc = new GridBagConstraints();
        fgbc.insets = new Insets(3, 6, 3, 6);
        fgbc.anchor = GridBagConstraints.WEST;

        int frow = 0;

        // File Start
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("File Start"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(fileStartTextField, fgbc);

        // File Duration
        frow++;
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("Duration"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(fileDurationTextField, fgbc);

        // Fade In (seconds)
        frow++;
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("Fade In (s)"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(fadeInTextField, fgbc);

        // Fade In Type
        frow++;
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("Fade In Type"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(fadeInTypeComboBox, fgbc);

        // Fade Out (seconds)
        frow++;
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("Fade Out (s)"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(fadeOutTextField, fgbc);

        // Fade Out Type
        frow++;
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("Fade Out Type"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(fadeOutTypeComboBox, fgbc);

        // Looping
        frow++;
        fgbc.gridx = 0; fgbc.gridy = frow;
        fgbc.fill = GridBagConstraints.NONE;
        fgbc.weightx = 0;
        filePropsPanel.add(new JLabel("Looping"), fgbc);
        fgbc.gridx = 1; fgbc.fill = GridBagConstraints.HORIZONTAL;
        fgbc.weightx = 1.0;
        filePropsPanel.add(loopingCheckbox, fgbc);

        // Add File Properties panel to content
        row++;
        gbc.gridx = 0; gbc.gridy = row;
        gbc.gridwidth = 2;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.weightx = 1.0;
        contentPanel.add(filePropsPanel, gbc);

        // Spacer to push everything to top
        row++;
        gbc.gridx = 0; gbc.gridy = row;
        gbc.gridwidth = 2;
        gbc.fill = GridBagConstraints.BOTH;
        gbc.weighty = 1.0;
        contentPanel.add(new JPanel(), gbc);

        // Wrap in scroll pane
        JScrollPane scrollPane = new JScrollPane(contentPanel);
        setLayout(new java.awt.BorderLayout());
        add(scrollPane, java.awt.BorderLayout.CENTER);
    }

    private void initListeners() {
        // Start Time panel changes
        startTimePanel.addPropertyChangeListener("timePosition", evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            isUpdating = true;
            try {
                TimePosition newPos = startTimePanel.getTimePosition();
                if (newPos != null) {
                    this.clip.setStartTime(newPos);
                }
            } finally {
                isUpdating = false;
            }
        });

        // Duration panel changes
        durationPanel.addPropertyChangeListener("timePosition", evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            isUpdating = true;
            try {
                TimeDuration newDur = durationPanel.getTimeDuration();
                if (newDur != null) {
                    TimeContext context = TimeContextManager.getContext();
                    double beats = newDur.toBeats(context);
                    beats = Math.max(0.0001, Math.min(beats, clip.getAudioDuration()));
                    this.clip.setSubjectiveDuration(
                            TimeUnitMath.beatsToDuration(beats,
                                    newDur.getTimeBase(), context));
                }
            } finally {
                isUpdating = false;
            }
        });

        // File Start
        fileStartTextField.addActionListener(evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            try {
                isUpdating = true;
                double val = parseTimeToSeconds(fileStartTextField.getText());
                val = Math.max(0.0, Math.min(val, clip.getAudioDuration()));
                this.clip.setFileStartTime(val);
            } catch (RuntimeException ex) {
                fileStartTextField.setText(
                        formatSecondsAsTime(this.clip.getFileStartTime()));
            } finally {
                isUpdating = false;
            }
        });

        // Fade In
        fadeInTextField.addActionListener(evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            try {
                isUpdating = true;
                double val = parseTimeToSeconds(fadeInTextField.getText());
                val = Math.max(0, Math.min(val,
                        clip.getSubjectiveDuration().toBeats(
                                TimeContextManager.getContext()) - clip.getFadeOut()));
                this.clip.setFadeIn(val);
            } catch (RuntimeException ex) {
                fadeInTextField.setText(
                        formatSecondsAsTime(this.clip.getFadeIn()));
            } finally {
                isUpdating = false;
            }
        });

        // Fade Out
        fadeOutTextField.addActionListener(evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            try {
                isUpdating = true;
                double val = parseTimeToSeconds(fadeOutTextField.getText());
                val = Math.max(0, Math.min(val,
                        clip.getSubjectiveDuration().toBeats(
                                TimeContextManager.getContext()) - clip.getFadeIn()));
                this.clip.setFadeOut(val);
            } catch (RuntimeException ex) {
                fadeOutTextField.setText(
                        formatSecondsAsTime(this.clip.getFadeOut()));
            } finally {
                isUpdating = false;
            }
        });

        // Fade In Type
        fadeInTypeComboBox.addActionListener(evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            isUpdating = true;
            this.clip.setFadeInType((FadeType) fadeInTypeComboBox.getSelectedItem());
            isUpdating = false;
        });

        // Fade Out Type
        fadeOutTypeComboBox.addActionListener(evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            isUpdating = true;
            this.clip.setFadeOutType((FadeType) fadeOutTypeComboBox.getSelectedItem());
            isUpdating = false;
        });

        // Looping
        loopingCheckbox.addActionListener(evt -> {
            if (this.clip == null || isUpdating) {
                return;
            }
            isUpdating = true;
            this.clip.setLooping(TimeContextManager.getContext(),
                    loopingCheckbox.isSelected());
            isUpdating = false;
        });
    }

    @Override
    public void editScoreObject(ScoreObject sObj) {
        final AudioClip newClip = (AudioClip) sObj;

        if (this.clip != null) {
            this.clip.removePropertyChangeListener(cl);
        }

        this.clip = newClip;

        isUpdating = true;

        String path = BlueSystem.getRelativePath(
                clip.getAudioFile().getAbsolutePath());
        audioFileNameTextField.setText(path);

        startTimePanel.setTimePosition(clip.getStartTime());
        durationPanel.setTimeDuration(clip.getSubjectiveDuration());

        fileStartTextField.setText(formatSecondsAsTime(clip.getFileStartTime()));
        fileDurationTextField.setText(formatSecondsAsTime(clip.getAudioDuration()));
        fadeInTextField.setText(formatSecondsAsTime(clip.getFadeIn()));
        fadeOutTextField.setText(formatSecondsAsTime(clip.getFadeOut()));

        fadeInTypeComboBox.setSelectedItem(clip.getFadeInType());
        fadeOutTypeComboBox.setSelectedItem(clip.getFadeOutType());

        loopingCheckbox.setSelected(clip.isLooping());

        isUpdating = false;

        this.clip.addPropertyChangeListener(cl);
    }

    /**
     * Formats a seconds value as H:MM:SS.mmm time string.
     */
    static String formatSecondsAsTime(double totalSeconds) {
        if (totalSeconds < 0) {
            totalSeconds = 0;
        }
        long totalMs = Math.round(totalSeconds * 1000.0);
        long hours = totalMs / 3_600_000;
        long minutes = (totalMs % 3_600_000) / 60_000;
        long seconds = (totalMs % 60_000) / 1_000;
        long ms = totalMs % 1_000;
        return String.format("%d:%02d:%02d.%03d", hours, minutes, seconds, ms);
    }

    /**
     * Parses a time string (H:MM:SS.mmm or plain seconds) to seconds.
     */
    static double parseTimeToSeconds(String text) {
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return 0.0;
        }

        // Try plain number first
        if (!trimmed.contains(":")) {
            return Double.parseDouble(trimmed);
        }

        // Parse H:MM:SS.mmm or MM:SS.mmm
        String[] parts = trimmed.split(":");
        long hours = 0;
        long minutes;
        String secPart;

        if (parts.length == 3) {
            hours = Long.parseLong(parts[0].trim());
            minutes = Long.parseLong(parts[1].trim());
            secPart = parts[2];
        } else if (parts.length == 2) {
            minutes = Long.parseLong(parts[0].trim());
            secPart = parts[1];
        } else {
            throw new IllegalArgumentException("Time format: H:MM:SS.mmm");
        }

        String[] secParts = secPart.split("\\.");
        long seconds = Long.parseLong(secParts[0].trim());
        long milliseconds = 0;
        if (secParts.length == 2) {
            String msStr = secParts[1].trim();
            // Pad or truncate to 3 digits
            while (msStr.length() < 3) msStr += "0";
            if (msStr.length() > 3) msStr = msStr.substring(0, 3);
            milliseconds = Long.parseLong(msStr);
        }

        return hours * 3600.0 + minutes * 60.0 + seconds + milliseconds / 1000.0;
    }
}
