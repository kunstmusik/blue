/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.ui.core.score.layers.soundObject.library;

import blue.BlueSystem;
import blue.library.Library;
import blue.soundObject.SoundObject;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.io.IOException;
import javafx.scene.input.DataFormat;
import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.text.DefaultEditorKit;
import org.openide.explorer.ExplorerManager;
import org.openide.explorer.ExplorerUtils;
import org.openide.explorer.view.BeanTreeView;
import org.openide.nodes.Node;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class UserSoundObjectLibrary extends JComponent implements ExplorerManager.Provider, Lookup.Provider {

    private transient ExplorerManager explorerManager = new ExplorerManager();

    Library<SoundObject> soundObjectLibrary;
    InstanceContent instanceContent;
    Lookup lookup;

    DataFormat sObjDataFormat = DataFormat.PLAIN_TEXT;

    public UserSoundObjectLibrary(InstanceContent instanceContent) {
        setLayout(new BorderLayout());
        soundObjectLibrary = BlueSystem.getSoundObjectLibrary();
        this.instanceContent = instanceContent;

        JLabel label = new JLabel("User SoundObject Library");
        this.add(label, BorderLayout.NORTH);

        label.setMinimumSize(new Dimension(0, 0));
        label.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createBevelBorder(BevelBorder.RAISED),
                new EmptyBorder(3, 3,
                        3, 3)));
        lookup = ExplorerUtils.createLookup(explorerManager,
                getActionMap());
        explorerManager.setRootContext(new UserSoundObjectLibraryNode(soundObjectLibrary.getRoot()));
        BeanTreeView btv = new BeanTreeView();
        btv.setRootVisible(true);
        add(btv, BorderLayout.CENTER);

        initActions();

//        JFXPanel jfxPanel = new JFXPanel();
//        this.add(jfxPanel, BorderLayout.CENTER);
//        
//        BlueFX.runOnFXThread(() -> {
//            TreeView<LibraryItem<SoundObject>> treeView = new TreeView<>();
//            treeView.setRoot(soundObjectLibrary.getRoot());
//
//            treeView.setEditable(true);
//            treeView.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
//            treeView.setCellFactory(tv -> {
//                return new LibraryItemCell();
//            });
//
//            treeView.getSelectionModel().selectedItemProperty().addListener(
//                    (obs, old, newVal) -> {
//
//                        if (newVal == null) {
//                            return;
//                        }
//                        if (newVal.getValue().getValue() != null) {
//                            instanceContent.set(
//                                    Collections.singleton(newVal.getValue().getValue()),
//                                    null);
//                        } else {
//                            instanceContent.set(Collections.emptyList(), null);
//                        }
//                    });
//
//            final Scene scene = new Scene(treeView);
//            BlueFX.style(scene);
//            jfxPanel.setScene(scene);
//
//            treeView.setContextMenu(buildContextMenu(treeView));
//
//        });
    }

    private void initActions() {
        var actions = getActionMap();

        actions.put(DefaultEditorKit.copyAction, ExplorerUtils.actionCopy(explorerManager));
//        actions.put(DefaultEditorKit.cutAction, ExplorerUtils.actionCut(explorerManager));

        actions.put(DefaultEditorKit.cutAction, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent ev) {

                if (explorerManager == null) {
                    return;
                }
                var explorerCut = ExplorerUtils.actionCut(explorerManager);

                Node[] sel = explorerManager.getSelectedNodes();
                explorerCut.actionPerformed(ev);
                for (var n : sel) {
                    try {
                        n.destroy();
                    } catch (IOException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                }
            }
        }
        );

        actions.put(DefaultEditorKit.pasteAction, ExplorerUtils.actionPaste(explorerManager));
        actions.put("delete", ExplorerUtils.actionDelete(explorerManager, true));
    }

//    public ContextMenu buildContextMenu(
//            TreeView<LibraryItem<SoundObject>> treeView) {
//        ContextMenu popupMenu = new ContextMenu();
////        popupMenu.getItems().add(new MenuItem("Test"));
//
//        ObservableList<TreeItem<LibraryItem<SoundObject>>> selectedItems
//                = treeView.getSelectionModel().getSelectedItems();
//        final ScoreController.ScoreObjectBuffer scoreObjectBuffer
//                = ScoreController.getInstance().getScoreObjectBuffer();
//
//        // FOLDER MENU ITEMS
//        List<MenuItem> folderMenuItems = new ArrayList<>();
//
//        MenuItem addFolder = new MenuItem("Add Folder");
//        addFolder.setOnAction(evt -> {
//            TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//            item.getChildren().add(new LibraryTreeItem(new LibraryItem<>("New Folder")));
//        });
//        MenuItem deleteFolder = new MenuItem("Delete Folder");
//        deleteFolder.setOnAction(evt -> {
//            TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//            item.getParent().getChildren().remove(item);
//        });
//
//        MenuItem paste = new MenuItem("Paste SoundObject");
//        paste.setOnAction(evt -> {
//            TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//            SoundObject sObj = (SoundObject) scoreObjectBuffer.scoreObjects.get(0).deepCopy();
//            if (!SoundObjectUtilities.isOrContainsInstance(sObj)) {
//                item.getChildren().add(new LibraryTreeItem(new LibraryItem<>(sObj)));
//            }
//        });
//
//        folderMenuItems.add(addFolder);
//        folderMenuItems.add(deleteFolder);
//        folderMenuItems.add(paste);
//
//        // FOLDER MENU ITEMS
//        List<MenuItem> sObjMenuItems = new ArrayList<>();
//
//        MenuItem cut = new MenuItem("Cut");
//        cut.setOnAction(evt -> {
//            TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//            SoundObject sObj = item.getValue().getValue();
//            if (sObj == null) {
//                return;
//            }
//
//            scoreObjectBuffer.clear();
//            scoreObjectBuffer.scoreObjects.add(sObj.deepCopy());
//            scoreObjectBuffer.layerIndexes.add(0);
//            item.getParent().getChildren().remove(item);
//        });
//
//        MenuItem copy = new MenuItem("Copy");
//        copy.setOnAction(evt -> {
//            TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//            SoundObject sObj = item.getValue().getValue();
//            if (sObj == null) {
//                return;
//            }
//
//            scoreObjectBuffer.clear();
//            scoreObjectBuffer.scoreObjects.add(sObj.deepCopy());
//            scoreObjectBuffer.layerIndexes.add(0);
//        });
//
//        MenuItem delete = new MenuItem("Delete");
//        delete.setOnAction(evt -> {
//            TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//            item.getParent().getChildren().remove(item);
//        });
//
//        sObjMenuItems.add(cut);
//        sObjMenuItems.add(copy);
//        sObjMenuItems.add(new SeparatorMenuItem());
//        sObjMenuItems.add(delete);
//
//        popupMenu.getItems().addAll(folderMenuItems);
//        popupMenu.getItems().addAll(sObjMenuItems);
//
//        popupMenu.setOnShowing(evt -> {
//            if (selectedItems.size() == 1) {
//                TreeItem<LibraryItem<SoundObject>> item = selectedItems.get(0);
//                boolean isFolder = item.getValue().getValue() == null;
//
//                deleteFolder.setDisable(item == soundObjectLibrary.getRoot());
//
//                if (isFolder) {
//                    boolean isScoreObj = scoreObjectBuffer.scoreObjects.size() == 1
//                            && scoreObjectBuffer.scoreObjects.get(0) instanceof SoundObject;
//
//                    if (isScoreObj) {
//                        SoundObject sObj = (SoundObject) scoreObjectBuffer.scoreObjects.get(0);
//                        paste.setDisable(SoundObjectUtilities.isOrContainsInstance(sObj));
//                    } else {
//                        paste.setDisable(true);
//                    }
//                }
//
//                for (MenuItem menuItem : folderMenuItems) {
//                    menuItem.setVisible(isFolder);
//                }
//                for (MenuItem menuItem : sObjMenuItems) {
//                    menuItem.setVisible(!isFolder);
//                }
//
//            }
//        });
//
//        return popupMenu;
//    }
//    class LibraryItemCell extends TextFieldTreeCell<LibraryItem<SoundObject>> {
//
//        private TextField textField;
//
//        public LibraryItemCell() {
//
//            // Drag and Drop is broken within JFXPanel... 
//            // at least on Windows...
//            // requires disabling assertions: 
//            // -da:com.sun.javafx.tk.quantum.EmbeddedSceneDnD 
//            // -da:javafx.embed.swing.SwingDnD 
//            // see: https://bugs.openjdk.java.net/browse/JDK-8178299
//            setOnDragDetected(evt -> {
//                if (getTreeView().getRow(getTreeItem()) != 0) {
//                    Dragboard db = startDragAndDrop(TransferMode.MOVE);
//                    ClipboardContent clipboard = new ClipboardContent();
//                    clipboard.putString("" + getTreeView().getRow(getTreeItem()));
//                    db.setContent(clipboard);
//                }
//                evt.consume();
//            });
//            setOnDragDropped(evt -> {
//                if (evt.getDragboard().getString() != null) {
//                    String item = evt.getDragboard().getString();
//
//                    try {
//                        int row = Integer.parseInt(item);
//                        TreeItem<LibraryItem<SoundObject>> treeItem = getTreeView().getTreeItem(row);
//                        treeItem.getParent().getChildren().remove(treeItem);
//                        getTreeItem().getChildren().add(treeItem);
//                        evt.setDropCompleted(true);
//                    } catch (Exception e) {
//
//                        evt.setDropCompleted(false);
//                    }
//                } else {
//                    evt.setDropCompleted(false);
//                }
//                evt.consume();
//            });
//            setOnDragOver(evt -> {
//                String val = evt.getDragboard().getString();
//                if (getTreeItem().getValue().getValue() == null
//                        && val != null) {
//
//                    int row = Integer.parseInt(val);
//                    TreeItem<LibraryItem<SoundObject>> treeItem = getTreeView().getTreeItem(row);
//
//                    if (!isInParentPath(treeItem, getTreeItem())
//                            && getTreeItem() != treeItem.getParent()) {
//                        evt.acceptTransferModes(TransferMode.MOVE);
//                    }
//                }
//                evt.consume();
//            });
//        }
//
//        private boolean isInParentPath(TreeItem<LibraryItem<SoundObject>> source, TreeItem<LibraryItem<SoundObject>> target) {
//            if (target == source) {
//                return true;
//            } else if (target == null) {
//                return false;
//            } else {
//                return isInParentPath(source, target.getParent());
//            }
//        }
//
//        @Override
//        public void startEdit() {
//            super.startEdit();
//
//            if (textField == null) {
//                createTextField();
//            }
//            setText(null);
//            setGraphic(textField);
//            textField.selectAll();
//        }
//
//        @Override
//        public void cancelEdit() {
//            super.cancelEdit();
//            setText(getItem().toString());
//            setGraphic(getTreeItem().getGraphic());
//        }
//
//        @Override
//        public void updateItem(LibraryItem<SoundObject> item, boolean empty) {
//            super.updateItem(item, empty);
//            boolean root = (item == soundObjectLibrary.getRoot().getValue());
//            setEditable(!root);
//
//            if (empty) {
//                setText(null);
//                setGraphic(null);
//            } else {
//                if (isEditing()) {
//                    if (textField != null) {
//                        textField.setText(getString());
//                    }
//                    setText(null);
//                    setGraphic(textField);
//                } else {
//                    setText(getString());
//                    setGraphic(getTreeItem().getGraphic());
//                }
//            }
//        }
//
//        private void createTextField() {
//            textField = new TextField(getString());
//            textField.setOnKeyReleased(new EventHandler<KeyEvent>() {
//
//                @Override
//                public void handle(KeyEvent t) {
//                    if (t.getCode() == KeyCode.ENTER) {
//                        String newVal = textField.getText().trim();
//                        if (getItem() != soundObjectLibrary.getRoot().getValue() && newVal.length() > 0) {
//                            getItem().setText(newVal);
//                            commitEdit(getItem());
//                        } else {
//                            cancelEdit();
//                        }
//                    } else if (t.getCode() == KeyCode.ESCAPE) {
//                        cancelEdit();
//                    }
//                }
//            });
//            textField.editableProperty().bind(editableProperty());
//        }
//
//        private String getString() {
//            return getItem() == null ? "" : getItem().toString();
//        }
//
//    }
    @Override

    public ExplorerManager getExplorerManager() {
        return explorerManager;
    }

    @Override
    public Lookup getLookup() {
        return lookup;
    }
}
