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

package blue.orchestra.editor.blueSynthBuilder;

import blue.BlueSystem;
import blue.components.EditEnabledCheckBox;
import blue.event.EditModeListener;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;

/**
 * @author Steven
 */
public class BSBInterfaceEditor extends JComponent implements PresetListener {

    private final BSBEditPanel bsbEditPanel;

    private final BSBObjectPropertySheet bsbPropSheet;

    PresetsPanel presets = new PresetsPanel();

    EditEnabledCheckBox editBox = new EditEnabledCheckBox();

    AlignmentPanel alignPanel = new AlignmentPanel();

    JPanel rightBar;

    private BSBGraphicInterface gInterface;

    boolean isUpdating = false;

    public BSBInterfaceEditor(BSBObjectEntry[] bsbObjectEntries,
            boolean showAutomatable) {

        bsbPropSheet = new BSBObjectPropertySheet(showAutomatable);

        bsbEditPanel = new BSBEditPanel(bsbObjectEntries);

        presets.addPresetListener(this);

        editBox.addEditModeListener(bsbEditPanel);
        editBox.addEditModeListener(new EditModeListener() {

            @Override
            public void setEditing(boolean isEditing) {
                rightBar.setVisible(isEditing);
            }

        });
        editBox.addEditModeListener(new EditModeListener() {

            @Override
            public void setEditing(boolean isEditing) {
                if (!isUpdating && gInterface != null) {
                    gInterface.setEditEnabled(isEditing);
                }
            }

        });

        JPanel topBar = new JPanel(new BorderLayout());
        topBar.add(presets, BorderLayout.CENTER);
        topBar.add(editBox, BorderLayout.EAST);

        JScrollPane editScrollPane = new JScrollPane(bsbEditPanel);
        editScrollPane.setAutoscrolls(true);

        rightBar = new JPanel(new BorderLayout());
        rightBar.add(new JLabel(BlueSystem
                .getString("instrument.bsb.objectProperties")),
                BorderLayout.NORTH);
        rightBar.add(bsbPropSheet, BorderLayout.CENTER);
        rightBar.add(alignPanel, BorderLayout.SOUTH);

        rightBar.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        this.setLayout(new BorderLayout());
        this.add(topBar, BorderLayout.NORTH);

        // JSplitPane split = new JSplitPane();
        // split.add(editScrollPane, JSplitPane.LEFT);
        // split.add(rightBar, JSplitPane.RIGHT);

        // this.add(split, BorderLayout.CENTER);

        this.add(editScrollPane, BorderLayout.CENTER);
        this.add(rightBar, BorderLayout.EAST);

        bsbPropSheet.setPreferredSize(new Dimension(250, 30));
        bsbEditPanel.addSelectionListener(bsbPropSheet);

        alignPanel.setJComponentArrayList(bsbEditPanel.getSelectionList());

        rightBar.setVisible(false);

        initActions();
    }

    /**
     * @param editBox
     */
    private void initActions() {
        this.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(
                KeyStroke.getKeyStroke(KeyEvent.VK_E, BlueSystem
                        .getMenuShortcutKey()), "switchEditMode");
        this.getActionMap().put("switchEditMode", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                editBox.doClick();
            }
        });
    }

    public void editInterface(BSBGraphicInterface gInterface, PresetGroup pGroup) {
        isUpdating = true;

        this.gInterface = gInterface;

        editBox.setEnabled(gInterface != null);

        if (gInterface != null) {
            if (editBox.isSelected() != gInterface.isEditEnabled()) {
                editBox.doClick();
            }
        }

        bsbPropSheet.clear();

        this.bsbEditPanel.editBSBGraphicInterface(gInterface);

        presets.setVisible(pGroup != null);

        if (pGroup != null) {
            this.presets.editPresetGroup(gInterface, pGroup);
        }

        isUpdating = false;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.editor.blueSynthBuilder.PresetListener#presetSelected(blue.orchestra.blueSynthBuilder.Preset)
     */
    @Override
    public void presetSelected(Preset preset) {
        if (gInterface != null) {
            preset.setInterfaceValues(gInterface);
            this.bsbEditPanel.editBSBGraphicInterface(gInterface);
        }
    }

}