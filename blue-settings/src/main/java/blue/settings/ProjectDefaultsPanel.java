/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.settings;

import blue.score.SnapValue;
import blue.time.TimeBase;
import blue.udo.UDOStyle;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.swing.BorderFactory;
import javax.swing.DefaultComboBoxModel;
import javax.swing.DefaultListCellRenderer;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.event.DocumentEvent;

import javax.swing.event.DocumentListener;

final class ProjectDefaultsPanel extends JPanel {

    private static final double[] SMPTE_FRAME_RATES = {
        23.976, 24.0, 25.0, 29.97, 30.0, 50.0, 59.94, 60.0
    };

    private static final String[] SMPTE_FRAME_RATE_LABELS = {
        "23.976 fps", "24 fps", "25 fps", "29.97 fps (drop)",
        "30 fps", "50 fps", "59.94 fps", "60 fps"
    };

    private static final Map<TimeBase, String> TIMEBASE_LABELS = new LinkedHashMap<>();

    static {
        TIMEBASE_LABELS.put(TimeBase.BEATS, "Beats");
        TIMEBASE_LABELS.put(TimeBase.BBT, "Bars.Beats.Ticks (BBT)");
        TIMEBASE_LABELS.put(TimeBase.BBST, "Bars.Beats.Sixteenths.Ticks (BBST)");
        TIMEBASE_LABELS.put(TimeBase.BBF, "Bars.Beats.Fraction (BBF)");
        TIMEBASE_LABELS.put(TimeBase.TIME, "Time (H:M:S.ms)");
        TIMEBASE_LABELS.put(TimeBase.SECONDS, "Seconds (decimal)");
        TIMEBASE_LABELS.put(TimeBase.SMPTE, "SMPTE (H:M:S:F)");
        TIMEBASE_LABELS.put(TimeBase.FRAME, "Samples");
    }

    private final ProjectDefaultsOptionsPanelController controller;
    private boolean loading = false;

    // Project defaults
    private final JTextField defaultAuthorText;
    private final JCheckBox mixerEnabledCheckBox;
    private final JComboBox<String> layerHeightDefaultComboBox;
    private final JComboBox<UDOStyle> defaultUDOStyleComboBox;

    // Timeline defaults
    private final JComboBox<TimeBase> primaryRulerCombo;
    private final JCheckBox secondaryRulerEnabledCheck;
    private final JComboBox<TimeBase> secondaryRulerCombo;
    private final JCheckBox snapEnabledCheck;
    private final JComboBox<SnapValue> snapValueCombo;
    private final JComboBox<String> smpteFrameRateCombo;

    ProjectDefaultsPanel(ProjectDefaultsOptionsPanelController controller) {
        this.controller = controller;

        defaultAuthorText = new JTextField();
        mixerEnabledCheckBox = new JCheckBox("Mixer Enabled");
        layerHeightDefaultComboBox = new JComboBox<>(
                new String[]{"1", "2", "3", "4", "5", "6", "7", "8", "9"});
        defaultUDOStyleComboBox = new JComboBox<>(new DefaultComboBoxModel<>(
                UDOStyle.values()));

        primaryRulerCombo = new JComboBox<>(new DefaultComboBoxModel<>(TimeBase.values()));
        secondaryRulerEnabledCheck = new JCheckBox("Enabled");
        secondaryRulerCombo = new JComboBox<>(new DefaultComboBoxModel<>(TimeBase.values()));
        snapEnabledCheck = new JCheckBox("Enabled");
        snapValueCombo = new JComboBox<>(new DefaultComboBoxModel<>(SnapValue.values()));
        smpteFrameRateCombo = new JComboBox<>(SMPTE_FRAME_RATE_LABELS);

        // Renderers for friendly display names
        var timeBaseRenderer = new DefaultListCellRenderer() {
            @Override
            public java.awt.Component getListCellRendererComponent(
                    javax.swing.JList<?> list, Object value, int index,
                    boolean isSelected, boolean cellHasFocus) {
                String label = (value instanceof TimeBase tb)
                        ? TIMEBASE_LABELS.getOrDefault(tb, tb.name()) : String.valueOf(value);
                return super.getListCellRendererComponent(list, label, index, isSelected, cellHasFocus);
            }
        };
        primaryRulerCombo.setRenderer(timeBaseRenderer);
        secondaryRulerCombo.setRenderer(timeBaseRenderer);

        var snapRenderer = new DefaultListCellRenderer() {
            @Override
            public java.awt.Component getListCellRendererComponent(
                    javax.swing.JList<?> list, Object value, int index,
                    boolean isSelected, boolean cellHasFocus) {
                String label = (value instanceof SnapValue sv) ? sv.getDisplayName() : String.valueOf(value);
                return super.getListCellRendererComponent(list, label, index, isSelected, cellHasFocus);
            }
        };
        snapValueCombo.setRenderer(snapRenderer);

        var udoStyleRenderer = new DefaultListCellRenderer() {
            @Override
            public java.awt.Component getListCellRendererComponent(
                    javax.swing.JList<?> list, Object value, int index,
                    boolean isSelected, boolean cellHasFocus) {
                String label = value instanceof UDOStyle style
                        ? getUDOStyleLabel(style)
                        : String.valueOf(value);
                return super.getListCellRendererComponent(list, label, index,
                        isSelected, cellHasFocus);
            }
        };
        defaultUDOStyleComboBox.setRenderer(udoStyleRenderer);

        initComponents();

        // Change listeners
        DocumentListener changeListener = new SimpleDocumentListener() {
            @Override
            public void documentChanged(DocumentEvent e) {
                if (!loading) {
                    ProjectDefaultsPanel.this.controller.changed();
                }
            }
        };
        defaultAuthorText.getDocument().addDocumentListener(changeListener);

        mixerEnabledCheckBox.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
        layerHeightDefaultComboBox.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
        defaultUDOStyleComboBox.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
        primaryRulerCombo.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
        secondaryRulerEnabledCheck.addActionListener(e -> {
            secondaryRulerCombo.setEnabled(secondaryRulerEnabledCheck.isSelected());
            if (!loading) {
                controller.changed();
            }
        });
        secondaryRulerCombo.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
        snapEnabledCheck.addActionListener(e -> {
            snapValueCombo.setEnabled(snapEnabledCheck.isSelected());
            if (!loading) {
                controller.changed();
            }
        });
        snapValueCombo.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
        smpteFrameRateCombo.addActionListener(e -> {
            if (!loading) {
                controller.changed();
            }
        });
    }

    private void initComponents() {
        setLayout(new GridBagLayout());
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(4, 4, 4, 4);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        int row = 0;

        // === Project Defaults section ===
        row = addSectionHeader("Project Defaults", row, gbc);

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.gridwidth = 1;
        gbc.weightx = 0;
        add(new JLabel("Default Author:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(defaultAuthorText, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Mixer:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(mixerEnabledCheckBox, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Layer Height:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(layerHeightDefaultComboBox, gbc);
        row++;

        // === User-Defined Opcodes section ===
        row = addSectionHeader("User-Defined Opcodes", row, gbc);

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Default UDO/Effect Style:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(defaultUDOStyleComboBox, gbc);
        row++;

        // === Timeline Defaults section ===
        row = addSectionHeader("Timeline Defaults", row, gbc);

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.gridwidth = 1;
        gbc.weightx = 0;
        add(new JLabel("Primary Ruler:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(primaryRulerCombo, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Secondary Ruler:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(secondaryRulerEnabledCheck, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Secondary Format:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(secondaryRulerCombo, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Snap:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(snapEnabledCheck, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("Snap Value:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(snapValueCombo, gbc);
        row++;

        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.weightx = 0;
        add(new JLabel("SMPTE Frame Rate:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 1.0;
        add(smpteFrameRateCombo, gbc);
        row++;

        // Vertical glue
        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.gridwidth = 2;
        gbc.weighty = 1.0;
        gbc.fill = GridBagConstraints.BOTH;
        add(new JLabel(), gbc);
    }

    private int addSectionHeader(String title, int row, GridBagConstraints gbc) {
        gbc.gridy = row;
        gbc.gridx = 0;
        gbc.gridwidth = 2;
        gbc.weightx = 0;
        gbc.weighty = 0;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.insets = new Insets(row == 0 ? 4 : 12, 4, 4, 4);
        JLabel header = new JLabel(title);
        header.setFont(header.getFont().deriveFont(Font.BOLD));
        add(header, gbc);
        gbc.insets = new Insets(4, 4, 4, 4);
        gbc.gridwidth = 1;
        return row + 1;
    }

    void load() {
        loading = true;

        ProjectDefaultsSettings settings = ProjectDefaultsSettings.getInstance();

        defaultAuthorText.setText(settings.defaultAuthor);
        mixerEnabledCheckBox.setSelected(settings.mixerEnabled);
        layerHeightDefaultComboBox.setSelectedIndex(settings.layerHeightDefault);
        defaultUDOStyleComboBox.setSelectedItem(settings.defaultUDOStyle);

        primaryRulerCombo.setSelectedItem(settings.defaultPrimaryTimeBase);
        secondaryRulerEnabledCheck.setSelected(settings.defaultSecondaryRulerEnabled);
        secondaryRulerCombo.setSelectedItem(settings.defaultSecondaryTimeBase);
        secondaryRulerCombo.setEnabled(settings.defaultSecondaryRulerEnabled);
        snapEnabledCheck.setSelected(settings.defaultSnapEnabled);
        snapValueCombo.setSelectedItem(settings.defaultSnapValue);
        snapValueCombo.setEnabled(settings.defaultSnapEnabled);
        smpteFrameRateCombo.setSelectedIndex(findClosestFrameRateIndex(settings.defaultSmpteFrameRate));

        loading = false;
    }

    void store() {
        ProjectDefaultsSettings settings = ProjectDefaultsSettings.getInstance();

        settings.defaultAuthor = defaultAuthorText.getText();
        settings.mixerEnabled = mixerEnabledCheckBox.isSelected();
        settings.layerHeightDefault = layerHeightDefaultComboBox.getSelectedIndex();
        settings.defaultUDOStyle = (UDOStyle) defaultUDOStyleComboBox
                .getSelectedItem();

        settings.defaultPrimaryTimeBase = (TimeBase) primaryRulerCombo.getSelectedItem();
        settings.defaultSecondaryRulerEnabled = secondaryRulerEnabledCheck.isSelected();
        settings.defaultSecondaryTimeBase = (TimeBase) secondaryRulerCombo.getSelectedItem();
        settings.defaultSnapEnabled = snapEnabledCheck.isSelected();
        settings.defaultSnapValue = (SnapValue) snapValueCombo.getSelectedItem();

        int frameRateIndex = smpteFrameRateCombo.getSelectedIndex();
        if (frameRateIndex >= 0 && frameRateIndex < SMPTE_FRAME_RATES.length) {
            settings.defaultSmpteFrameRate = SMPTE_FRAME_RATES[frameRateIndex];
        }

        settings.save();
    }

    boolean valid() {
        return true;
    }

    private static int findClosestFrameRateIndex(double frameRate) {
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

    private static String getUDOStyleLabel(UDOStyle style) {
        return switch (style) {
            case CLASSIC -> "Classic";
            case MODERN -> "Modern";
        };
    }
}
