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

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;

import blue.BlueSystem;
import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.orchestra.editor.blueSynthBuilder.jfx.BSBEditPane;
import blue.orchestra.editor.blueSynthBuilder.jfx.PresetPane;
import com.l2fprod.common.propertysheet.PropertyEditorRegistry;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.beans.PropertyEditor;
import java.util.concurrent.CountDownLatch;
import javafx.collections.ObservableList;
import javafx.collections.ObservableSet;
import javafx.collections.SetChangeListener;
import javafx.embed.swing.JFXPanel;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.SplitPane;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.layout.BorderPane;
import org.controlsfx.control.PropertySheet;
import org.controlsfx.property.BeanPropertyUtils;
import org.openide.util.Exceptions;

/**
 * @author Steven
 */
public class BSBInterfaceEditor extends JComponent implements PresetListener,
        PropertyChangeListener {

    // JFX
    private BSBEditPane bsbEditPane = null;

    TabPane rightPane;
    PresetPane presetPane;
    CheckBox editEnabledCheckBox;

    PropertySheet bsbObjPropSheet;
    PropertySheet gridPropSheet;

    // SWING
    AlignmentPanel alignPanel = new AlignmentPanel();

    // data
    private BSBGraphicInterface gInterface;

    boolean isUpdating = false;

    private double dividerPosition = 0.8;

    public BSBInterfaceEditor(BSBObjectEntry[] bsbObjectEntries,
            boolean showAutomatable) {

        JFXPanel jfxPanel = new JFXPanel();

        CountDownLatch latch = new CountDownLatch(1);

        BlueFX.runOnFXThread(() -> {

            try {
                bsbObjPropSheet = new PropertySheet();
                bsbObjPropSheet.setSearchBoxVisible(false);
                bsbObjPropSheet.setModeSwitcherVisible(false);
                gridPropSheet = new PropertySheet();
                gridPropSheet.setSearchBoxVisible(false);
                gridPropSheet.setModeSwitcherVisible(false);

                Tab bsbObjPropTab = new Tab("BSBObject Properties", bsbObjPropSheet);
                bsbObjPropTab.setClosable(false);
                Tab gridTab = new Tab("Grid", gridPropSheet);
                gridTab.setClosable(false);

                rightPane = new TabPane(bsbObjPropTab, gridTab);
                rightPane.setPrefWidth(250);

                bsbEditPane = new BSBEditPane(bsbObjectEntries);
                ScrollPane scrollPane = new ScrollPane(bsbEditPane);

                bsbEditPane.getSelection().selection.addListener(
                        (SetChangeListener<? super BSBObject>) se -> {
                            if (!bsbEditPane.isMarqueeSelecting()) {
                                updateBsbObjPropSheet();
                            }
                        });

                bsbEditPane.marqueeSelectingProperty().addListener((obs, old, newVal) -> {
                    if (!newVal) {
                        updateBsbObjPropSheet();
                    }
                });

                // ensure edit pane is at least size of viewport so that mouse
                // actions will work even on empty interface
                scrollPane.viewportBoundsProperty().addListener((obs, old, newVal) -> {
                    bsbEditPane.setMinWidth(newVal.getWidth());
                    bsbEditPane.setMinHeight(newVal.getHeight());
                });
                scrollPane.getStyleClass().add("edge-to-edge");

                presetPane = new PresetPane();
                editEnabledCheckBox = new CheckBox("Edit Enabled");

                presetPane.setMargin(editEnabledCheckBox,
                        new Insets(5, 5, 5, 0));
                presetPane.getChildren().add(editEnabledCheckBox);

                SplitPane editAreaPane = new SplitPane(scrollPane);

                BorderPane mainPane = new BorderPane();
                mainPane.setTop(presetPane);
                mainPane.setCenter(editAreaPane);

                final Scene scene = new Scene(mainPane);
                BlueFX.style(scene);
                jfxPanel.setScene(scene);

                editEnabledCheckBox.selectedProperty().addListener((obs, old, newVal) -> {
                    ObservableList<Node> items = editAreaPane.getItems();
                    if (newVal) {
                        if (!items.contains(rightPane)) {
                            items.add(rightPane);
                            editAreaPane.setDividerPosition(0, dividerPosition);
                        }
                    } else if (items.contains(rightPane)) {
                        dividerPosition = editAreaPane.getDividerPositions()[0];
                        items.remove(rightPane);
                    }
                });
            } finally {
                latch.countDown();
            }
        });

        try {
            latch.await();
        } catch (InterruptedException ex) {
            Exceptions.printStackTrace(ex);
        }

//        presets.addPresetListener(this);
        // FIXME
//        editBox.addEditModeListener(bsbEditPanel);
//        editBox.addEditModeListener(isEditing ->
//                rightBar.setVisible(isEditing));
//
//        editBox.addEditModeListener((boolean isEditing) -> {
//            if (!isUpdating && gInterface != null) {
//                BlueFX.runOnFXThread(
//                        () -> gInterface.setEditEnabled(isEditing));
//            }
//        });
//        JPanel topBar = new JPanel(new BorderLayout());
//        topBar.add(presets, BorderLayout.CENTER);
//
//        JTabbedPane tabs = new JTabbedPane();
//        tabs.add(BlueSystem
//                .getString("instrument.bsb.objectProperties"), bsbPropSheet);
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
//        rightBar.add(tabs, BorderLayout.CENTER);
//        rightBar.add(alignPanel, BorderLayout.SOUTH);
//
//        rightBar.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        this.setLayout(new BorderLayout());
//        this.add(topBar, BorderLayout.NORTH);

        // JSplitPane split = new JSplitPane();
        // split.add(editScrollPane, JSplitPane.LEFT);
        // split.add(rightBar, JSplitPane.RIGHT);
        // this.add(split, BorderLayout.CENTER);
        this.add(jfxPanel, BorderLayout.CENTER);
//        this.add(rightBar, BorderLayout.EAST);

//        bsbPropSheet.setPreferredSize(new Dimension(250, 30));
        // FIXME
//        bsbEditPanel.addSelectionListener(bsbPropSheet);
// FIXME
//        alignPanel.setJComponentList(bsbEditPanel.getSelectionList());
//        rightBar.setVisible(false);
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
                BlueFX.runOnFXThread(() -> {
                    if (gInterface != null) {
                        gInterface.setEditEnabled(!gInterface.isEditEnabled());
                    }
                });
            }
        });
    }

    public void editInterface(BSBGraphicInterface gInterface, PresetGroup pGroup) {

        BlueFX.runOnFXThread(() -> {
            if (this.gInterface == gInterface) {
                return;
            }

            isUpdating = true;

            if (this.gInterface != null) {
                editEnabledCheckBox.selectedProperty().unbindBidirectional(
                        this.gInterface.editEnabledProperty());
                rightPane.visibleProperty().unbind();
            }

            this.gInterface = gInterface;

            gridPropSheet.getItems().clear();
            bsbObjPropSheet.getItems().clear();

            if (gInterface != null) {
                editEnabledCheckBox.selectedProperty().bindBidirectional(
                        this.gInterface.editEnabledProperty());

                rightPane.visibleProperty().bind(this.gInterface.editEnabledProperty());

                gridPropSheet.getItems().addAll(
                        BeanPropertyUtils.getProperties(this.gInterface.getGridSettings()));
            }

            bsbEditPane.editBSBGraphicInterface(gInterface);
        });

        presetPane.setVisible(pGroup != null);

        if (pGroup != null) {
//            this.presets.editPresetGroup(gInterface, pGroup);
            presetPane.setPresetGroup(pGroup);
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
            BlueFX.runOnFXThread(()
                    -> bsbEditPane.editBSBGraphicInterface(gInterface)
            );
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        throw new UnsupportedOperationException("Not supported yet."); //To change body of generated methods, choose Tools | Templates.
    }

    private void updateBsbObjPropSheet() {
        ObservableSet<? extends BSBObject> set
                = bsbEditPane.getSelection().selection;

        bsbObjPropSheet.getItems().clear();
        if (set.size() != 1) {
            bsbObjPropSheet.getItems().addAll(
                    BeanPropertyUtils.getProperties(set.iterator().next()));
        }
    }

    /**
     * The Class PropertyEditorRegistryEx.
     *
     * Code used from:
     * http://cgu-emp.googlecode.com/svn/trunk/EMP/src/edu/cgu/emp/swing/analysis/ObjectInspectorJPanel.java
     */
    private static class PropertyEditorRegistryEx extends PropertyEditorRegistry {

        // We will try to get the "nearest" super class.        
        /* (non-Javadoc)
         * @see com.l2fprod.common.propertysheet.PropertyEditorRegistry#getEditor(java.lang.Class)
         */
        @Override
        @SuppressWarnings("rawtypes")
        public synchronized PropertyEditor getEditor(Class type) {
            PropertyEditor editor = super.getEditor(type);

            Class c = type;

            while (editor == null) {
                c = c.getSuperclass();

                if (c == null) {
                    return editor;
                }

                editor = super.getEditor(c);
            }

            return editor;
        }
    }
}
