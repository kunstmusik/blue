/*
 * blue - object composition environment for csound
 * Copyright (c) 2026 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.pianoRoll;

import blue.soundObject.PianoRoll;
import blue.ui.core.score.TimeDisplayFormat;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Frame;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import javax.swing.BorderFactory;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;

/**
 * Modal dialog for configuring PianoRoll ruler display settings.
 * Includes a "Use Global Ruler Settings" checkbox that, when enabled,
 * inherits settings from the Score's timeline.
 *
 * @author Steven Yi
 */
public class PianoRollRulerConfigDialog extends JDialog {

    private final JCheckBox useGlobalRulerCheck;
    private final JComboBox<TimeDisplayFormat> primaryFormatCombo;
    private final JCheckBox secondaryEnabledCheck;
    private final JComboBox<TimeDisplayFormat> secondaryFormatCombo;

    private final JPanel localSettingsPanel;

    private PianoRoll pianoRoll;
    private boolean confirmed = false;

    public PianoRollRulerConfigDialog(Frame owner) {
        super(owner, "PianoRoll Ruler Configuration", true);

        useGlobalRulerCheck = new JCheckBox("Use Global Ruler Settings");
        primaryFormatCombo = new JComboBox<>(new DefaultComboBoxModel<>(TimeDisplayFormat.values()));
        secondaryEnabledCheck = new JCheckBox("Enabled");
        secondaryFormatCombo = new JComboBox<>(new DefaultComboBoxModel<>(TimeDisplayFormat.values()));

        localSettingsPanel = new JPanel(new GridBagLayout());

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

        // Use Global Ruler
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.gridwidth = 2;
        mainPanel.add(useGlobalRulerCheck, gbc);

        // Local settings panel
        buildLocalSettingsPanel();
        gbc.gridy = 1;
        gbc.gridwidth = 2;
        gbc.weightx = 1.0;
        mainPanel.add(localSettingsPanel, gbc);

        // Hook: toggle local settings visibility
        useGlobalRulerCheck.addActionListener(e -> {
            setLocalSettingsEnabled(!useGlobalRulerCheck.isSelected());
        });

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
            applyToPianoRoll();
            setVisible(false);
        });

        buttonPanel.add(cancelButton);
        buttonPanel.add(okButton);

        setLayout(new BorderLayout());
        add(mainPanel, BorderLayout.CENTER);
        add(buttonPanel, BorderLayout.SOUTH);

        getRootPane().setDefaultButton(okButton);
    }

    private void buildLocalSettingsPanel() {
        localSettingsPanel.setBorder(BorderFactory.createTitledBorder("Local Ruler Settings"));

        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(4, 4, 4, 4);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;

        // Primary Ruler
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.gridwidth = 2;
        JLabel primaryLabel = new JLabel("Primary Ruler");
        primaryLabel.setFont(primaryLabel.getFont().deriveFont(java.awt.Font.BOLD));
        localSettingsPanel.add(primaryLabel, gbc);

        gbc.gridy = 1;
        gbc.gridwidth = 1;
        localSettingsPanel.add(new JLabel("Format:"), gbc);

        gbc.gridx = 1;
        gbc.weightx = 1.0;
        localSettingsPanel.add(primaryFormatCombo, gbc);

        // Secondary Ruler
        gbc.gridx = 0;
        gbc.gridy = 2;
        gbc.gridwidth = 2;
        gbc.weightx = 0;
        gbc.insets = new Insets(10, 4, 4, 4);
        JLabel secondaryLabel = new JLabel("Secondary Ruler");
        secondaryLabel.setFont(secondaryLabel.getFont().deriveFont(java.awt.Font.BOLD));
        localSettingsPanel.add(secondaryLabel, gbc);

        gbc.gridy = 3;
        gbc.insets = new Insets(4, 4, 4, 4);
        localSettingsPanel.add(secondaryEnabledCheck, gbc);

        gbc.gridy = 4;
        gbc.gridwidth = 1;
        localSettingsPanel.add(new JLabel("Format:"), gbc);

        gbc.gridx = 1;
        gbc.weightx = 1.0;
        localSettingsPanel.add(secondaryFormatCombo, gbc);

        secondaryEnabledCheck.addActionListener(e -> {
            secondaryFormatCombo.setEnabled(secondaryEnabledCheck.isSelected());
        });
    }

    private void setLocalSettingsEnabled(boolean enabled) {
        primaryFormatCombo.setEnabled(enabled);
        secondaryEnabledCheck.setEnabled(enabled);
        secondaryFormatCombo.setEnabled(enabled && secondaryEnabledCheck.isSelected());
    }

    public void setPianoRoll(PianoRoll pianoRoll) {
        this.pianoRoll = pianoRoll;
        loadFromPianoRoll();
    }

    private void loadFromPianoRoll() {
        if (pianoRoll == null) return;

        useGlobalRulerCheck.setSelected(pianoRoll.isUseGlobalRuler());

        TimeDisplayFormat primaryFormat = TimeDisplayFormat.fromTimeBase(pianoRoll.getPrimaryTimeDisplay());
        primaryFormatCombo.setSelectedItem(primaryFormat);

        secondaryEnabledCheck.setSelected(pianoRoll.isSecondaryRulerEnabled());
        secondaryFormatCombo.setEnabled(pianoRoll.isSecondaryRulerEnabled());
        TimeDisplayFormat secondaryFormat = TimeDisplayFormat.fromTimeBase(pianoRoll.getSecondaryTimeDisplay());
        secondaryFormatCombo.setSelectedItem(secondaryFormat);

        setLocalSettingsEnabled(!pianoRoll.isUseGlobalRuler());
    }

    private void applyToPianoRoll() {
        if (pianoRoll == null) return;

        pianoRoll.setUseGlobalRuler(useGlobalRulerCheck.isSelected());

        if (!useGlobalRulerCheck.isSelected()) {
            TimeDisplayFormat primaryFormat = (TimeDisplayFormat) primaryFormatCombo.getSelectedItem();
            if (primaryFormat != null) {
                pianoRoll.setPrimaryTimeDisplay(primaryFormat.getTimeBase());
            }

            pianoRoll.setSecondaryRulerEnabled(secondaryEnabledCheck.isSelected());
            TimeDisplayFormat secondaryFormat = (TimeDisplayFormat) secondaryFormatCombo.getSelectedItem();
            if (secondaryFormat != null) {
                pianoRoll.setSecondaryTimeDisplay(secondaryFormat.getTimeBase());
            }
        }
    }

    public boolean showDialog() {
        confirmed = false;
        setVisible(true);
        return confirmed;
    }
}
