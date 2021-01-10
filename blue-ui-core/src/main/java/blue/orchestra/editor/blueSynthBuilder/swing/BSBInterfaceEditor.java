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
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;

import blue.BlueSystem;
import blue.components.EditEnabledCheckBox;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import com.l2fprod.common.propertysheet.PropertyEditorRegistry;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.beans.PropertyEditor;
import javax.swing.JLabel;
import javax.swing.JTabbedPane;

/**
 * @author Steven
 */
public class BSBInterfaceEditor extends JComponent implements PresetListener {

    private final BSBEditPanel bsbEditPanel;

    private final BSBObjectPropertySheet bsbPropSheet;

//    PropertySheetPanel gridPropertySheet = new PropertySheetPanel();

    PresetsPanel presets = new PresetsPanel();

    EditEnabledCheckBox editBox = new EditEnabledCheckBox();

//    AlignmentPanel alignPanel = new AlignmentPanel();

    JPanel rightBar = new JPanel(new BorderLayout());

    private BSBGraphicInterface gInterface;

    boolean isUpdating = false;

    public BSBInterfaceEditor(BSBObjectEntry[] bsbObjectEntries,
            boolean showAutomatable) {

        
        bsbEditPanel = new BSBEditPanel(bsbObjectEntries);

        bsbPropSheet = new BSBObjectPropertySheet(showAutomatable, bsbEditPanel.getSelection());


        presets.addPresetListener(this);

        editBox.addEditModeListener(bsbEditPanel);
        editBox.addEditModeListener(isEditing ->
                rightBar.setVisible(isEditing));

        editBox.addEditModeListener((boolean isEditing) -> {
            if (!isUpdating && gInterface != null) {
                gInterface.setEditEnabled(isEditing);
            }
        });

        JPanel topBar = new JPanel(new BorderLayout());
        topBar.add(presets, BorderLayout.CENTER);
        topBar.add(editBox, BorderLayout.EAST);

        JScrollPane editScrollPane = new JScrollPane(bsbEditPanel);
        editScrollPane.setAutoscrolls(true);

        JTabbedPane tabs = new JTabbedPane();
        tabs.add(BlueSystem
                .getString("instrument.bsb.objectProperties"), bsbPropSheet);
        
        // FIXME:
        tabs.add("Grid", new JLabel("FIXME"));
//        tabs.add("Grid", gridPropertySheet);
//
//        gridPropertySheet.setMode(PropertySheet.VIEW_AS_FLAT_LIST);
//        gridPropertySheet.setToolBarVisible(false);
//        gridPropertySheet.setDescriptionVisible(false);
//        gridPropertySheet.getTable().setEditorFactory(
//                new PropertyEditorRegistryEx());
//        PropertyEditorRegistry registry = (PropertyEditorRegistry) gridPropertySheet.getTable().getEditorFactory();
//        registry.registerEditor(Enum.class, new EnumComboBoxPropertyEditor());
//        gridPropertySheet.setPreferredSize(new Dimension(250, 30));
//
//        gridPropertySheet.addPropertySheetChangeListener((PropertyChangeEvent evt) -> {
//            if (gInterface != null) {
//                Property prop = (Property) evt.getSource();
//                prop.writeToObject(gInterface.getGridSettings());
//            }
//        });
//
//        try {
//            gridPropertySheet.setBeanInfo(Introspector.getBeanInfo(
//                    GridSettings.class, Object.class));
//        } catch (IntrospectionException ex) {
//            Exceptions.printStackTrace(ex);
//        }

//        rightBar.add(new JLabel(BlueSystem
//                .getString("instrument.bsb.objectProperties")),
//                BorderLayout.NORTH);
//        rightBar.add(bsbPropSheet, BorderLayout.CENTER);
        rightBar.add(tabs, BorderLayout.CENTER);
//        rightBar.add(alignPanel, BorderLayout.SOUTH);

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
        
//        alignPanel.setJComponentList(bsbEditPanel.getSelectionList());

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

        if (this.gInterface == gInterface) {
            return;
        }

        isUpdating = true;

        this.gInterface = gInterface;

        editBox.setEnabled(gInterface != null);

        // FIXME
        if (gInterface != null) {
            if (editBox.isSelected() != gInterface.isEditEnabled()) {
                editBox.doClick();
            }
//            gridPropertySheet.readFromObject(gInterface.getGridSettings());
        } else {
//            gridPropertySheet.readFromObject(null);
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
