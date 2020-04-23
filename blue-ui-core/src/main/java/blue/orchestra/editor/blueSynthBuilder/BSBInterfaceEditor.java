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
import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.orchestra.editor.blueSynthBuilder.jfx.BSBEditPane;
import blue.orchestra.editor.blueSynthBuilder.jfx.editors.BSBPropertyEditorFactory;
import blue.orchestra.editor.blueSynthBuilder.jfx.PresetPane;
import javafx.collections.ListChangeListener;
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
import javafx.scene.control.TreeItem;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import org.controlsfx.control.BreadCrumbBar;
import org.controlsfx.control.PropertySheet;
import org.controlsfx.property.BeanPropertyUtils;

/**
 * @author Steven
 */
public class BSBInterfaceEditor extends JComponent {

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

        BlueFX.runOnFXThread(() -> {

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

            HBox.setMargin(editEnabledCheckBox,
                    new Insets(5, 5, 5, 0));
            presetPane.getChildren().add(editEnabledCheckBox);

            BreadCrumbBar<BSBGroupItem> breadCrumbBar = new BreadCrumbBar<>();
            breadCrumbBar.setAutoNavigationEnabled(false);

            bsbEditPane.getGroupsList().addListener(
                    (ListChangeListener.Change<? extends BSBGroup> c) -> {
                        ObservableList<BSBGroup> groupsList
                        = bsbEditPane.getGroupsList();
                        if (groupsList.size() > 0) {
                            TreeItem<BSBGroupItem> current = new TreeItem<>(
                                    new BSBGroupItem(groupsList.get(0), "Root"));
                            for (int i = 1; i < groupsList.size(); i++) {
                                BSBGroup bsbGroup = groupsList.get(i);
                                TreeItem<BSBGroupItem> next
                                = new TreeItem<>(
                                        new BSBGroupItem(
                                                bsbGroup,
                                                bsbGroup.getGroupName()));
                                current.getChildren().add(next);
                                current = next;
                            }
                            breadCrumbBar.setSelectedCrumb(current);
                        }
                    });

            breadCrumbBar.setOnCrumbAction(item -> {
                BSBGroupItem groupItem = item.getSelectedCrumb().getValue();
                ObservableList<BSBGroup> groups = bsbEditPane.getGroupsList();
                int index = groups.indexOf(groupItem.bsbGroup) + 1;
                if (index < groups.size()) {
                    groups.remove(index, groups.size());
                }
            });

            VBox topBox = new VBox();
            topBox.getChildren().addAll(presetPane, breadCrumbBar);

            SplitPane editAreaPane = new SplitPane(scrollPane);

            BorderPane mainPane = new BorderPane();
            mainPane.setTop(topBox);
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
                    if (!topBox.getChildren().contains(breadCrumbBar)) {
                        topBox.getChildren().add(breadCrumbBar);
                    }
                } else {
                    if (items.contains(rightPane)) {
                        dividerPosition = editAreaPane.getDividerPositions()[0];
                        items.remove(rightPane);
                    }
                    topBox.getChildren().remove(breadCrumbBar);
                }
            });
            bsbEditPane.requestFocus();

        });

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

            presetPane.setBSBInterface(gInterface);
            presetPane.setPresetGroup(pGroup);

            editEnabledCheckBox.setDisable(gInterface == null);
        });

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

class BSBGroupItem {

    public final BSBGroup bsbGroup;
    public final String displayName;

    public BSBGroupItem(BSBGroup bsbGroup, String displayName) {
        this.bsbGroup = bsbGroup;
        this.displayName = displayName;
    }

    public String toString() {
        return displayName;
    }
}
