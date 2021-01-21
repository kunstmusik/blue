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
package blue.orchestra.editor.blueSynthBuilder.swing;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;

import blue.BlueSystem;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import javafx.beans.value.ChangeListener;
import javax.swing.JCheckBox;
import javax.swing.JSplitPane;
import javax.swing.JTabbedPane;
import javax.swing.SwingUtilities;

/**
 * @author Steven
 */
public class BSBInterfaceEditor extends JComponent implements PresetListener {

    private final BSBEditPanel bsbEditPanel;

    private final BSBObjectPropertySheet bsbPropSheet;
    private final GridSettingsEditPanel gridSettingsEditPanel;
    JSplitPane splitPane;
    JTabbedPane rightTabs;

    PresetsPanel presets = new PresetsPanel();
    BreadCrumbBar breadCrumbBar; 

    JCheckBox editBox;

//    JPanel rightBar = new JPanel(new BorderLayout());
    private BSBGraphicInterface gInterface;

    volatile boolean isUpdating = false;
    ChangeListener<Boolean> editEnabledListener;
    

    public BSBInterfaceEditor(BSBObjectEntry[] bsbObjectEntries,
            boolean showAutomatable) {

        bsbEditPanel = new BSBEditPanel(bsbObjectEntries);

        bsbPropSheet = new BSBObjectPropertySheet(showAutomatable, bsbEditPanel.getSelection());

        presets.addPresetListener(this);

        editBox = new JCheckBox("Edit Enabled");

        editBox.addActionListener(ae -> {
            if (isUpdating || gInterface == null) {
                return;
            }
            isUpdating = true;

            gInterface.setEditEnabled(editBox.isSelected());

            isUpdating = false;
        });

        JPanel topBar = new JPanel(new BorderLayout());
        topBar.add(presets, BorderLayout.CENTER);
        topBar.add(editBox, BorderLayout.EAST);

        JScrollPane editScrollPane = new JScrollPane(bsbEditPanel);
        editScrollPane.setAutoscrolls(true);

        rightTabs = new JTabbedPane();
        rightTabs.add(BlueSystem
                .getString("instrument.bsb.objectProperties"), bsbPropSheet);

        gridSettingsEditPanel = new GridSettingsEditPanel();
        rightTabs.add("Grid", gridSettingsEditPanel);

        this.setLayout(new BorderLayout());
        this.add(topBar, BorderLayout.NORTH);

        splitPane = new JSplitPane();
        splitPane.setLeftComponent(editScrollPane);
        splitPane.setRightComponent(rightTabs);
        
        breadCrumbBar = new BreadCrumbBar(bsbEditPanel.getGroupsList());

        JPanel middle = new JPanel(new BorderLayout());
        middle.add(breadCrumbBar, BorderLayout.NORTH);
        middle.add(splitPane, BorderLayout.CENTER);
        
        this.add(middle, BorderLayout.CENTER);

        bsbPropSheet.setPreferredSize(new Dimension(250, 30));

        initActions();

        editEnabledListener = (obs, old, newVal) -> setupEditInterface();
    }

    private void setupEditInterface() {
        if (gInterface == null) {
            return;
        }

        if (gInterface.isEditEnabled()) {
            if (!rightTabs.isVisible()) {
                int savedLoc = (Integer) splitPane.getClientProperty("savedLoc");
                int savedDividerSize = (Integer) splitPane.getClientProperty("savedDividerSize");
                rightTabs.setVisible(true);
                splitPane.setDividerLocation(savedLoc);
                splitPane.setDividerSize(savedDividerSize);
            }
        } else if (rightTabs.isVisible()) {
            splitPane.putClientProperty("savedLoc", splitPane.getDividerLocation());
            splitPane.putClientProperty("savedDividerSize", splitPane.getDividerSize());
            rightTabs.setVisible(false);
//            splitPane.setDividerLocation(1.0);
            splitPane.setDividerSize(0);
        }
        
        breadCrumbBar.setVisible(gInterface.isEditEnabled());
    }

    @Override
    public void addNotify() {
        super.addNotify();

        SwingUtilities.invokeLater(
                () -> splitPane.setDividerLocation(splitPane.getWidth() - 250));
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

        if (this.gInterface == gInterface) {
            return;
        }

        isUpdating = true;

        if (this.gInterface != null) {
            this.gInterface.editEnabledProperty().removeListener(editEnabledListener);
        }

        this.gInterface = gInterface;

        editBox.setEnabled(gInterface != null);

        // FIXME
        if (gInterface != null) {
            this.gInterface.editEnabledProperty().addListener(editEnabledListener);
            editBox.setSelected(this.gInterface.isEditEnabled());
        }
        setupEditInterface();

        bsbPropSheet.clear();

        try {
            this.bsbEditPanel.editBSBGraphicInterface(gInterface);
            gridSettingsEditPanel.editGridSettings(gInterface.getGridSettings());

            presets.setVisible(pGroup != null);

            if (pGroup != null) {
                this.presets.editPresetGroup(gInterface, pGroup);
            }

        } finally {
            isUpdating = false;
        }
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
