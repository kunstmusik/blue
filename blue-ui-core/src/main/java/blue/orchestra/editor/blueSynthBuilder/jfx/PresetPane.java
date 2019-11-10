/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
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
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.orchestra.editor.blueSynthBuilder.PresetsManagerDialog;
import blue.orchestra.editor.blueSynthBuilder.PresetsUtilities;
import java.util.Collections;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.geometry.Side;
import javafx.scene.control.Button;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Menu;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SeparatorMenuItem;
import javafx.scene.control.TextField;
import javafx.scene.control.TextInputDialog;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class PresetPane extends HBox {

    private ObjectProperty<PresetGroup> presetGroup;
    private BSBGraphicInterface bsbInterface = null;

    ContextMenu rootMenu = new ContextMenu();
    PresetsManagerDialog presetsManager = null;
    TextField currentPresetText = new TextField();
    Button updateButton = new Button("Update");

    EventHandler<ActionEvent> addFolderAction;
    EventHandler<ActionEvent> addPresetAction;
    EventHandler<ActionEvent> presetSelectedAction;

    public PresetPane() {
        this.addFolderAction = e -> {
            MenuItem source = (MenuItem) e.getSource();
            PresetGroup pGroup = (PresetGroup) source.getUserData();
            addFolder(pGroup);
        };
        this.addPresetAction = e -> {
            MenuItem source = (MenuItem) e.getSource();
            PresetGroup pGroup = (PresetGroup) source.getUserData();
            addPreset(pGroup);
        };
        this.presetSelectedAction = e -> {
            MenuItem source = (MenuItem) e.getSource();
            Preset preset = (Preset) source.getUserData();
            preset.setInterfaceValues(bsbInterface);

            getPresetGroup().setCurrentPresetUniqueId(preset.getUniqueId());
            getPresetGroup().setCurrentPresetModified(false);
            updateCurrentPresetUI();
        };

        presetGroup = new SimpleObjectProperty<>();

        Button presetsButton = new Button("Presets");
        presetsButton.setOnAction(e -> {
            rootMenu.show(presetsButton, Side.TOP, USE_PREF_SIZE, USE_PREF_SIZE);
        });
        currentPresetText.setEditable(false);
        updateButton.setOnAction(e -> {

            PresetGroup pGroup = getPresetGroup();
            Preset preset = pGroup.findPresetByUniqueId(pGroup.getCurrentPresetUniqueId());

            if (preset != null) {
                preset.updatePresets(bsbInterface);
                pGroup.setCurrentPresetModified(false);
                updateCurrentPresetUI();
            }
        });

        HBox.setHgrow(currentPresetText, Priority.ALWAYS);
        getChildren().addAll(presetsButton, currentPresetText, updateButton);
        setMargin(presetsButton, new Insets(5));
        setMargin(currentPresetText, new Insets(5, 0, 5, 0));
        setMargin(updateButton, new Insets(5, 5, 5, 0));

        setAlignment(Pos.CENTER);

        presetsButton.visibleProperty().bind(presetGroupProperty().isNotNull());
        currentPresetText.visibleProperty().bind(presetGroupProperty().isNotNull());
        updateButton.visibleProperty().bind(presetGroupProperty().isNotNull());
    }

    public PresetGroup getPresetGroup() {
        return presetGroup.get();
    }

    public void setPresetGroup(PresetGroup presetGroup) {
        this.presetGroup.set(presetGroup);
        updatePresetMenu();
        updateCurrentPresetUI();
    }

    public ObjectProperty<PresetGroup> presetGroupProperty() {
        return presetGroup;
    }

    public void setBSBInterface(BSBGraphicInterface bsbInterface) {
        this.bsbInterface = bsbInterface;
    }

    public void updatePresetMenu() {
        rootMenu.getItems().clear();
        if (getPresetGroup() != null) {
            setPresetsMenu(getPresetGroup(), null);
        }
    }

    private void setPresetsMenu(PresetGroup pGroup, Menu parent) {

        for (PresetGroup subGroup : pGroup.getSubGroups()) {
            Menu menu = new Menu(subGroup.getPresetGroupName());
            setPresetsMenu(subGroup, menu);

            if (parent == null) {
                rootMenu.getItems().add(menu);
            } else {
                parent.getItems().add(menu);
            }
        }

        for (Preset preset : pGroup.getPresets()) {
            MenuItem item = new MenuItem(preset.getPresetName());
            item.setUserData(preset);
            item.setOnAction(presetSelectedAction);

            if (parent == null) {
                rootMenu.getItems().add(item);
            } else {
                parent.getItems().add(item);
            }
        }

        if (parent == null) {
            rootMenu.getItems().add(new SeparatorMenuItem());
        } else {
            parent.getItems().add(new SeparatorMenuItem());
        }

        MenuItem addFolder = new MenuItem("Add Folder");
        addFolder.setUserData(pGroup);
        addFolder.setOnAction(addFolderAction);

        MenuItem addPreset = new MenuItem("Add Preset");
        addPreset.setUserData(pGroup);
        addPreset.setOnAction(addPresetAction);

        if (parent == null) {
            MenuItem syncPresets = new MenuItem("Synchronize Presets");
            syncPresets.setOnAction(e -> {
                PresetsUtilities.synchronizePresets(
                        getPresetGroup(), bsbInterface);
            });
            MenuItem managePresets = new MenuItem("Manage Presets");
            managePresets.setOnAction(e -> {
                PresetGroup[] retVal = new PresetGroup[1];

                CountDownLatch latch = new CountDownLatch(1);

                SwingUtilities.invokeLater(() -> {
                    try {
                        if (presetsManager == null) {
                            presetsManager = new PresetsManagerDialog(
                                    WindowManager.getDefault().getMainWindow());
                        }

                        retVal[0] = presetsManager.editPresetGroup(pGroup);
                    } finally {
                        latch.countDown();
                    }
                });

                try {
                    latch.await();
                } catch (InterruptedException ex) {
                    Exceptions.printStackTrace(ex);
                }

                if (retVal[0] != null) {
                    pGroup.setPresets(retVal[0].getPresets());
                    pGroup.setSubGroups(retVal[0].getSubGroups());
                    updatePresetMenu();

                    Preset preset = pGroup.findPresetByUniqueId(pGroup.getCurrentPresetUniqueId());

                    if (preset == null) {
                        pGroup.setCurrentPresetUniqueId(null);
                        pGroup.setCurrentPresetModified(false);
                    }

                    updateCurrentPresetUI();
                }
            });

            rootMenu.getItems().addAll(addFolder, addPreset, new SeparatorMenuItem(), syncPresets, managePresets);
        } else {
            parent.getItems().addAll(addFolder, addPreset);
        }
    }

    protected void updateCurrentPresetUI() {
        if(getPresetGroup() == null) {
            return;
        }
        if (getPresetGroup().getCurrentPresetUniqueId() == null) {
            currentPresetText.setText(" No Preset Selected");
            updateButton.setDisable(true);
        } else {
            PresetGroup pGroup = getPresetGroup();
            Preset preset = pGroup.findPresetByUniqueId(pGroup.getCurrentPresetUniqueId());
            String presetText = " Current Preset: ";

            if (preset != null) {
                String presetPath = pGroup.getPresetFullPathName(pGroup.getCurrentPresetUniqueId());
                presetText += presetPath;
            }

            currentPresetText.setText(presetText);
            updateButton.setDisable(false);
        }
    }

    /**
     * @param currentPresetGroup
     */
    private void addPreset(PresetGroup currentPresetGroup) {

        TextInputDialog dlg = new TextInputDialog();
        dlg.setTitle("Enter Preset Name");
        dlg.setHeaderText("Enter Preset Name");
        dlg.setGraphic(null);
        BlueFX.style(dlg.getDialogPane());
        Optional<String> str = dlg.showAndWait();

        if (!str.isPresent() || str.get().length() == 0) {
            return;
        }

        Preset preset = Preset.createPreset(bsbInterface);
        preset.setPresetName(str.get());

        currentPresetGroup.getPresets().add(preset);
        Collections.sort(currentPresetGroup.getPresets());

        getPresetGroup().setCurrentPresetUniqueId(preset.getUniqueId());
        getPresetGroup().setCurrentPresetModified(false);

        updatePresetMenu();
        updateCurrentPresetUI();
    }

    /**
     * @param currentPresetGroup
     */
    protected void addFolder(PresetGroup presetGroup) {
        TextInputDialog dlg = new TextInputDialog();
        dlg.setTitle("Enter Folder Name");
        dlg.setHeaderText("Enter Folder Name");
        dlg.setGraphic(null);
        BlueFX.style(dlg.getDialogPane());
        Optional<String> str = dlg.showAndWait();

        if (!str.isPresent() || str.get().length() == 0) {
            return;
        }

        String folderName = str.get();

        if (folderName.length() == 0) {
            return;
        }

        PresetGroup newFolder = new PresetGroup();
        newFolder.setPresetGroupName(folderName);

        presetGroup.getSubGroups().add(newFolder);

        Collections.sort(presetGroup.getSubGroups());

        updatePresetMenu();
    }

}
