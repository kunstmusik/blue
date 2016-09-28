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
import blue.orchestra.editor.blueSynthBuilder.jfx.editors.BSBPropertyEditorFactory;
import blue.orchestra.editor.blueSynthBuilder.jfx.PresetPane;
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
public class BSBInterfaceEditor extends JComponent implements PresetListener {

    private BSBEditPane bsbEditPane = null;
    private TabPane rightPane;
    private PresetPane presetPane;
    private CheckBox editEnabledCheckBox;
    private PropertySheet bsbObjPropSheet;
    private PropertySheet gridPropSheet;

    private BSBGraphicInterface gInterface;

    private double dividerPosition = 0.8;

    // TODO - move JFX code into FXML/Controller
    public BSBInterfaceEditor(BSBObjectEntry[] bsbObjectEntries,
            boolean showAutomatable) {

        JFXPanel jfxPanel = new JFXPanel();

        CountDownLatch latch = new CountDownLatch(1);

        BlueFX.runOnFXThread(() -> {

            try {
                bsbObjPropSheet = new PropertySheet();
                bsbObjPropSheet.setSearchBoxVisible(false);
                bsbObjPropSheet.setModeSwitcherVisible(false);
                bsbObjPropSheet.setPropertyEditorFactory(new BSBPropertyEditorFactory());

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

        this.setLayout(new BorderLayout());
        this.add(jfxPanel, BorderLayout.CENTER);
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
            presetPane.setPresetGroup(pGroup);
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
            BlueFX.runOnFXThread(()
                    -> bsbEditPane.editBSBGraphicInterface(gInterface)
            );
        }
    }

    private void updateBsbObjPropSheet() {
        ObservableSet<? extends BSBObject> set
                = bsbEditPane.getSelection().selection;

        bsbObjPropSheet.getItems().clear();
        if (set.size() == 1) {
            bsbObjPropSheet.getItems().addAll(
                    BeanPropertyUtils.getProperties(set.iterator().next()));
        }
    }

}
