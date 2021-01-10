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

import blue.BlueSystem;
import blue.orchestra.blueSynthBuilder.BSBFileSelector;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.FileUtilities;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.dnd.*;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.IOException;
import java.net.URLDecoder;
import java.util.List;
import javafx.beans.value.ChangeListener;
import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JPopupMenu;
import javax.swing.JTextField;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.util.Exceptions;

/**
 * @author steven
 * @author Michael Bechard
 */
public class BSBFileSelectorView extends BSBObjectView<BSBFileSelector> {

    private static final int FILE_BUTTON_WIDTH = 30;
    private static int OBJECT_HEIGHT = 30;
    private static String FILE_SELECTOR_ID = "BSBFileSelector";

    JTextField fileNameField = new JTextField();

    ChangeListener<String> fileNameListener;
    ChangeListener<Number> textWidthListener;

    public BSBFileSelectorView(BSBFileSelector selector) {
        super(selector);

        fileNameField.setEditable(false);

        JButton fileButton = new JButton("...");
        fileButton.addActionListener((ActionEvent e) -> {
            String fileName = selector.getFileName();

            if (fileName != null && fileName.trim().length() > 0) {
                File file = BlueSystem.findFile(fileName);

                if (file != null) {
                    FileChooserManager.getDefault().setSelectedFile(
                            FILE_SELECTOR_ID,
                            file);
                }
            }

            List<File> rValue = FileChooserManager.getDefault().showOpenDialog(
                    FILE_SELECTOR_ID, this);

            if (!rValue.isEmpty()) {
                File f = rValue.get(0);

                try {
                    String absFilePath = f.getCanonicalPath();
                    String relPath = BlueSystem.getRelativePath(absFilePath);

                    System.out.println("Rel Path: " + relPath);
                    selector.setFileName(relPath);
                } catch (IOException e1) {
                    // TODO Auto-generated catch block
                    e1.printStackTrace();
                }

            }
        });

        fileButton.setPreferredSize(new Dimension(FILE_BUTTON_WIDTH,
                OBJECT_HEIGHT));

        this.setSize(selector.getTextFieldWidth() + FILE_BUTTON_WIDTH,
                OBJECT_HEIGHT);

        fileNameField.setSize(selector.getTextFieldWidth(), OBJECT_HEIGHT);

        this.setLayout(new BorderLayout());
        this.add(fileNameField, BorderLayout.CENTER);
        this.add(fileButton, BorderLayout.EAST);

        fileNameField.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {
                requestFocus();
                if (UiUtilities.isRightMouseButton(e)) {
                    showPopup(e.getX(), e.getY());
                }
            }
        });

        new BSBFileSelectorDropTargetListener(this, fileNameField);

        fileNameField.setText(bsbObj.getFileName());
        fileNameField.setToolTipText(bsbObj.getFileName());
        revalidate();

        fileNameListener = (obs, old, newVal) -> {
            fileNameField.setText(newVal);
            fileNameField.setToolTipText(bsbObj.getFileName());
        };
        textWidthListener = (obs, old, newVal) -> {
            fileNameField.setSize(newVal.intValue(), OBJECT_HEIGHT);
            setSize(getPreferredSize());
        };
    }

    @Override
    public void addNotify() {
        super.addNotify();

        bsbObj.fileNameProperty().addListener(fileNameListener);
        bsbObj.textFieldWidthProperty().addListener(textWidthListener);

    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        bsbObj.fileNameProperty().removeListener(fileNameListener);
        bsbObj.textFieldWidthProperty().removeListener(textWidthListener);
    }

    public void resetText() {
        getBSBObject().setFileName("");
    }

    @Override
    public Dimension getPreferredSize() {
        return new Dimension(bsbObj.getTextFieldWidth() + FILE_BUTTON_WIDTH, OBJECT_HEIGHT);
    }

    private void showPopup(int x, int y) {
        JPopupMenu popup = new JPopupMenu();
        popup.add(new AbstractAction("Clear") {
            @Override
            public void actionPerformed(ActionEvent e) {
                bsbObj.setFileName("");
            }
        });
        popup.add(new AbstractAction("Copy to Media Folder") {
            @Override
            public void actionPerformed(ActionEvent e) {
                final var projectDir = BlueSystem.getCurrentProjectDirectory();

                if (projectDir == null || !projectDir.exists()) {
                    var nd = new NotifyDescriptor("Please save this project before copying to the media directory.",
                            "Project not saved yet", NotifyDescriptor.DEFAULT_OPTION,
                            NotifyDescriptor.ERROR_MESSAGE,
                            null, null);
                    DialogDisplayer.getDefault().notify(nd);
                    return;
                }

                final var f = BlueSystem.findFile(bsbObj.getFileName());

                if (f == null) {
                    return;
                }

                final var fParent = f.getParentFile();

                final var mediaFolder = BlueSystem.getCurrentBlueData().getProjectProperties().mediaFolder;

                final var targetDir = FileUtilities.resolveAndCreateMediaFolder(projectDir, mediaFolder);

                var targetFile = new File(targetDir, f.getName());

                if (f.exists() && f.isFile() && !targetFile.equals(fParent)) {

                    targetFile = FileUtilities.copyToMediaFolder(f, targetFile);

                    if (targetFile != null) {
                        String absFilePath;
                        try {
                            absFilePath = targetFile.getCanonicalPath();
                            String relPath = BlueSystem.getRelativePath(absFilePath);
                            bsbObj.setFileName(relPath);
                        } catch (IOException ex) {
                            Exceptions.printStackTrace(ex);
                        }
                    }

                }
            }
        });
        
        popup.show(this, x, y);
    }

    static class BSBFileSelectorDropTargetListener extends DropTargetAdapter {

        private final BSBFileSelectorView bsbFileSelectorView;
        private DropTarget target;

        private BSBFileSelectorDropTargetListener(BSBFileSelectorView bsbFileSelectorView,
                JTextField fileNameField) {
            this.bsbFileSelectorView = bsbFileSelectorView;
            target = new DropTarget(fileNameField, this);
        }

        @Override
        public void dragEnter(DropTargetDragEvent dtde) {

            boolean isFile = dtde.isDataFlavorSupported(
                    DataFlavor.javaFileListFlavor);

            if (!isFile) {
                if (dtde.isDataFlavorSupported(DataFlavor.stringFlavor)) {
                    isFile = true;
                }
            }

            if (isFile) {
                dtde.acceptDrag(DnDConstants.ACTION_LINK);
            } else {
                dtde.rejectDrag();
            }
        }

        @Override
        public void drop(DropTargetDropEvent dtde) {
            try {
                Transferable tr = dtde.getTransferable();

                if (dtde.isDataFlavorSupported(DataFlavor.javaFileListFlavor)) {
                    dtde.acceptDrop(DnDConstants.ACTION_LINK);

                    List list = (List) tr.getTransferData(
                            DataFlavor.javaFileListFlavor);

                    if (list.size() != 1) {
                        dtde.dropComplete(false);
                        return;
                    }

                    String s = list.get(0).toString().trim();

                    File f = new File(s);

                    if (f.exists() && f.isFile()) {

                        try {
                            String absFilePath = f.getCanonicalPath();
                            String relPath = BlueSystem.getRelativePath(
                                    absFilePath);

                            bsbFileSelectorView.getBSBObject().setFileName(relPath);
                        } catch (IOException e1) {
                            // TODO Auto-generated catch block
                            e1.printStackTrace();
                        }

                        dtde.dropComplete(true);
                        return;
                    }
                    dtde.dropComplete(false);
                    dtde.rejectDrop();
                } else if (dtde.isDataFlavorSupported(DataFlavor.stringFlavor)) {
                    dtde.acceptDrop(DnDConstants.ACTION_LINK);

                    String str = (String) tr.getTransferData(
                            DataFlavor.stringFlavor);

                    if (!str.startsWith("file://")) {
                        dtde.dropComplete(false);
                        return;
                    }

                    str = str.substring(7).trim();
                    str = URLDecoder.decode(str);
                    str = str.replaceAll(" ", "\\ ");

                    File f = new File(str);

                    if (f.exists() && f.isFile()) {

                        try {
                            String absFilePath = f.getCanonicalPath();
                            String relPath = BlueSystem.getRelativePath(
                                    absFilePath);

                            bsbFileSelectorView.getBSBObject().setFileName(relPath);
                        } catch (IOException e1) {
                            // TODO Auto-generated catch block
                            e1.printStackTrace();
                        }
                        dtde.dropComplete(true);
                        return;
                    }
                }
                dtde.rejectDrop();
            } catch (UnsupportedFlavorException | IOException e) {
                e.printStackTrace();
                dtde.rejectDrop();
            }
        }
    }
}
