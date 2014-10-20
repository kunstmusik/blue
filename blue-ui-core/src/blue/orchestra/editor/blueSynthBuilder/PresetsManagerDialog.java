/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;

import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JFileChooser;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTree;
import javax.swing.filechooser.FileFilter;
import javax.swing.tree.TreePath;
import javax.swing.tree.TreeSelectionModel;

import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.settings.GeneralSettings;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import blue.utility.GenericFileFilter;
import blue.utility.ObjectUtilities;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.ParseException;

/**
 * @author Steven
 */
public class PresetsManagerDialog extends JDialog implements
        WindowSettingsSavable {

    private final PresetsTreePopup popup = new PresetsTreePopup();

    JTree tree = new JTree();

    PresetsTreeModel model;

    PresetGroup retVal = null;

    PresetsBuffer buffer = PresetsBuffer.getInstance();

    public PresetsManagerDialog(Frame owner) {
        super(owner);
        this.setModal(true);
        this.setTitle("Presets Manager");

        JPanel mainPanel = (JPanel) this.getContentPane();
        mainPanel.setLayout(new BorderLayout());

        JScrollPane jsp = new JScrollPane(tree);
        jsp.setPreferredSize(new Dimension(300, 500));

        JPanel bottomPanel = new JPanel();

        JButton saveButton = new JButton(BlueSystem.getString("common.save"));
        saveButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                retVal = (PresetGroup) model.getRoot();
                setVisible(false);
            }

        });

        JButton cancelButton = new JButton(BlueSystem
                .getString("programOptions.cancelButton"));
        cancelButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                setVisible(false);
            }

        });

        bottomPanel.add(saveButton);
        bottomPanel.add(cancelButton);

        mainPanel.add(jsp, BorderLayout.CENTER);
        mainPanel.add(bottomPanel, BorderLayout.SOUTH);

        this.pack();
        GUI.centerOnScreen(this);

        tree.setEditable(true);
        tree.getSelectionModel().setSelectionMode(
                TreeSelectionModel.SINGLE_TREE_SELECTION);

        new PresetsTreeDragSource(tree, DnDConstants.ACTION_MOVE);
        new PresetsTreeDropTarget(tree);

        tree.addMouseListener(new MouseAdapter() {

            public void mouseClicked(MouseEvent e) {

                TreePath path = tree.getSelectionPath();
                if (path == null) {
                    return;
                }

                Object userObject = path.getLastPathComponent();

                if (UiUtilities.isRightMouseButton(e)) {
                    showPopup(userObject, e.getX(), e.getY());
                }

            }

        });

        WindowSettingManager.getInstance().registerWindow(
                "PresetsManagerDialog", this);
    }

    private void showPopup(Object userObj, int x, int y) {
        popup.show(this, userObj, x, y);
    }

    private void setPresetGroup(PresetGroup presetGroup) {
        if (tree.isEditing()) {
            tree.cancelEditing();
        }

        model = new PresetsTreeModel(presetGroup);
        tree.setModel(model);
    }

    public PresetGroup editPresetGroup(PresetGroup presetGroup) {
        PresetGroup groupCopy = (PresetGroup) ObjectUtilities
                .clone(presetGroup);

        setPresetGroup(groupCopy);

        this.setVisible(true);
        PresetGroup returnValue = retVal;

        retVal = null;

        return returnValue;
    }

    public static void main(String[] args) {
        new PresetsManagerDialog(null).setVisible(true);
        System.exit(0);
    }

    class PresetsTreePopup extends JPopupMenu {

        private static final String IMPORT_DIALOG = "preset.import";

        private static final String EXPORT_DIALOG = "preset.export";

        JMenuItem addFolder = new JMenuItem("Add Folder");

        JMenuItem remove = new JMenuItem(BlueSystem.getString("common.remove"));

        JMenuItem cut = new JMenuItem(BlueSystem.getString("common.cut"));

        JMenuItem copy = new JMenuItem(BlueSystem.getString("common.copy"));

        JMenuItem paste = new JMenuItem(BlueSystem.getString("common.paste"));

        JMenuItem importItem = new JMenuItem(BlueSystem
                .getString("common.import"));

        JMenuItem export = new JMenuItem(BlueSystem.getString("common.export"));

        private Object userObj;

        public PresetsTreePopup() {
            this.add(remove);
            this.addSeparator();
            this.add(cut);
            this.add(copy);
            this.add(paste);
            this.addSeparator();
            this.add(importItem);
            this.add(export);
            this.addSeparator();
            this.add(addFolder);

            remove.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    if (userObj == null) {
                        return;
                    }

                    if (userObj instanceof Preset) {
                        model.removePreset((Preset) userObj);
                    } else if (userObj instanceof PresetGroup) {
                        model.removePresetGroup((PresetGroup) userObj);
                    }
                }

            });

            cut.addActionListener(new ActionListener() {
                public void actionPerformed(ActionEvent e) {
                    if (userObj == null) {
                        return;
                    }

                    if (userObj instanceof Preset) {
                        buffer.setBufferedItem((Preset) ObjectUtilities
                                .clone(userObj));
                        model.removePreset((Preset) userObj);
                    } else {
                        buffer.setBufferedItem((PresetGroup) ObjectUtilities
                                .clone(userObj));
                        model.removePresetGroup((PresetGroup) userObj);
                    }
                }

            });

            copy.addActionListener(new ActionListener() {
                public void actionPerformed(ActionEvent e) {
                    if (userObj == null) {
                        return;
                    }

                    if (userObj instanceof Preset) {
                        buffer.setBufferedItem((Preset) ObjectUtilities
                                .clone(userObj));
                    } else {
                        buffer.setBufferedItem((PresetGroup) ObjectUtilities
                                .clone(userObj));
                    }
                }

            });

            paste.addActionListener(new ActionListener() {
                public void actionPerformed(ActionEvent e) {
                    if (userObj == null || !(userObj instanceof PresetGroup)) {
                        return;
                    }

                    PresetGroup group = (PresetGroup) userObj;

                    Object item = buffer.getBufferedItem();

                    if (item instanceof Preset) {
                        model.addPreset(group, (Preset) ObjectUtilities
                                .clone(item));
                    } else {
                        model.addPresetGroup(group,
                                (PresetGroup) ObjectUtilities.clone(item));
                    }

                }
            });

            importItem.addActionListener(new ActionListener() {
                public void actionPerformed(ActionEvent e) {
                    if (userObj == null || !(userObj instanceof PresetGroup)) {
                        return;
                    }

                    int retVal = FileChooserManager.getDefault().showOpenDialog(
                            IMPORT_DIALOG, PresetsManagerDialog.this);

                    if (retVal == JFileChooser.APPROVE_OPTION) {

                        PresetGroup group = (PresetGroup) userObj;

                        File f = FileChooserManager.getDefault()
                                .getSelectedFile(IMPORT_DIALOG);
                        Document doc;

                        try {
                            doc = new Document(f);
                            Element root = doc.getRoot();
                            if (root.getName().equals("presetGroup")) {
                                PresetGroup pGroup = PresetGroup
                                        .loadFromXML(root);
                                model.addPresetGroup(group, pGroup);
                            } else if (root.getName().equals("preset")) {
                                Preset p = Preset.loadFromXML(root);
                                model.addPreset(group, p);
                            } else {
                                JOptionPane.showMessageDialog(
                                        PresetsManagerDialog.this,
                                        "Error: File did not contain presets",
                                        "Error", JOptionPane.ERROR_MESSAGE);
                            }

                        } catch (ParseException ex) {
                            ex.printStackTrace();
                            JOptionPane.showMessageDialog(
                                    PresetsManagerDialog.this,
                                    "Error: Could not read presets from file",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                        }

                    }
                }
            });

            export.addActionListener(new ActionListener() {
                public void actionPerformed(ActionEvent e) {
                    if (userObj == null) {
                        return;
                    }

                    int retVal = FileChooserManager.getDefault().showSaveDialog(
                            EXPORT_DIALOG, PresetsManagerDialog.this);

                    if (retVal == JFileChooser.APPROVE_OPTION) {

                        File f = FileChooserManager.getDefault()
                                .getSelectedFile(EXPORT_DIALOG);

                        if (f.exists()) {
                            int overWrite = JOptionPane
                                    .showConfirmDialog(
                                            PresetsManagerDialog.this,
                                            "Please confirm you would like to overwrite this file.");

                            if (overWrite != JOptionPane.OK_OPTION) {
                                return;
                            }
                        }

                        Element node;

                        if (userObj instanceof PresetGroup) {
                            node = ((PresetGroup) userObj).saveAsXML();
                        } else if (userObj instanceof Preset) {
                            node = ((Preset) userObj).saveAsXML();
                        } else {
                            return;
                        }
                        PrintWriter out;

                        try {
                            out = new PrintWriter(new FileWriter(f));
                            out.print(node.toString());

                            out.flush();
                            out.close();
                        } catch (IOException ex) {
                            ex.printStackTrace();
                        }

                    }

                }
            });

            addFolder.addActionListener(new ActionListener() {
                public void actionPerformed(ActionEvent e) {
                    if (userObj == null || !(userObj instanceof PresetGroup)) {
                        return;
                    }

                    PresetGroup pGroup = (PresetGroup) userObj;

                    PresetGroup newGroup = new PresetGroup();
                    newGroup.setPresetGroupName("New Folder");

                    model.addPresetGroup(pGroup, newGroup);
                }
            });

            /* setup file choosers */

            File defaultFile = new File(GeneralSettings.getInstance()
                    .getDefaultDirectory()
                    + File.separator + "default.preset");

            FileFilter presetFilter = new GenericFileFilter("preset",
                    "Preset file");

            FileChooserManager.getDefault().addFilter(IMPORT_DIALOG, presetFilter);
            FileChooserManager.getDefault().setDialogTitle(IMPORT_DIALOG, "Import Presets");
            FileChooserManager.getDefault().setSelectedFile(IMPORT_DIALOG, defaultFile);

            FileChooserManager.getDefault().addFilter(EXPORT_DIALOG, presetFilter);
            FileChooserManager.getDefault().setDialogTitle(EXPORT_DIALOG, "Export Presets");
            FileChooserManager.getDefault().setSelectedFile(EXPORT_DIALOG, defaultFile);
        }

        /**
         * @param dialog
         * @param userObj
         * @param x
         * @param y
         */
        public void show(PresetsManagerDialog dialog, Object userObj, int x,
                int y) {
            if (userObj == null) {
                return;
            }

            this.userObj = userObj;

            paste.setEnabled((userObj instanceof PresetGroup)
                    && buffer.hasItem());
            importItem.setEnabled(userObj instanceof PresetGroup);
            addFolder.setEnabled(userObj instanceof PresetGroup);
            remove.setEnabled(userObj != model.getRoot());
            cut.setEnabled(userObj != model.getRoot());

            super.show(dialog, x, y);
        }
    }

    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }
}