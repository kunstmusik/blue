/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.udo;

import blue.BlueSystem;
import blue.gui.DragManager;
import blue.settings.GeneralSettings;
import blue.udo.OpcodeList;
import blue.udo.UDOCategory;
import blue.udo.UserDefinedOpcode;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Document;
import electric.xml.Element;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.Point;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.dnd.DnDConstants;
import java.awt.dnd.DragGestureEvent;
import java.awt.dnd.DragGestureListener;
import java.awt.dnd.DragGestureRecognizer;
import java.awt.dnd.DragSource;
import java.awt.dnd.DragSourceAdapter;
import java.awt.dnd.DragSourceDropEvent;
import java.awt.dnd.DropTarget;
import java.awt.dnd.DropTargetAdapter;
import java.awt.dnd.DropTargetDragEvent;
import java.awt.dnd.DropTargetDropEvent;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.List;
import javafx.stage.FileChooser;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.filechooser.FileNameExtensionFilter;
import org.openide.util.Exceptions;

/**
 * @author steven
 */
public class OpcodeListEditPanel extends JComponent {

    private static final String EXPORT_BLUE_UDO_DIALOG = "blue.udo.export";
    private static final String EXPORT_CSOUND_UDO_DIALOG = "csound.udo.export";
    private static final String IMPORT_BLUE_UDO_DIALOG = "blue.udo.import";
    private static final String IMPORT_CSOUND_UDO_DIALOG = "csound.udo.import";

    UDORepositoryBrowser browser = null;

    JPopupMenu importPopup = new JPopupMenu();
    UDOPopup popup = new UDOPopup();

    JTable table;

    JLabel label;

    OpcodeList opcodeList = null;

    public OpcodeListEditPanel() {

        table = new JTable() {
            @Override
            public boolean getScrollableTracksViewportHeight() {
                return getPreferredSize().height < getParent().getHeight();
            }
        };

        table.setSelectionMode(ListSelectionModel.MULTIPLE_INTERVAL_SELECTION);

        Insets smallButtonInsets = new Insets(0, 3, 0, 3);

        label = new JLabel("User-Defined Opcodes");
        label.setBorder(BorderFactory.createCompoundBorder(BorderFactory
                .createBevelBorder(BevelBorder.RAISED), new EmptyBorder(3, 3,
                3, 3)));

        JButton addButton = new JButton("+");
        addButton.setMargin(smallButtonInsets);
        addButton.setToolTipText("Add User-Defined Opcode");
        addButton.addActionListener((ActionEvent e) -> {
            addUDO();
        });

        JMenuItem importBlueUDO = new JMenuItem("Import Blue UDO");
        importBlueUDO.addActionListener(ae -> importBlueUdo());

        JMenuItem importCsoundUDO = new JMenuItem("Import Csound UDO");
        importCsoundUDO.addActionListener(ae -> importCsoundUdo());

        importPopup.add(importBlueUDO);
        importPopup.add(importCsoundUDO);

        JButton importButton = new JButton("I");
        importButton.setMargin(new Insets(1, 6, 1, 7));
        importButton
                .setToolTipText("Import User-Defined Opcode");
        importButton.addActionListener((ActionEvent e) -> {
            importPopup.show(importButton, importButton.getX(),
                    importButton.getHeight());
        });

        JButton removeButton = new JButton("-");
        removeButton.setMargin(new Insets(1, 4, 1, 5));
        removeButton.setToolTipText("Remove User-Defined Opcode");
        removeButton.addActionListener((ActionEvent e) -> {
            removeUDO();
        });

        JButton pushUpButton = new JButton("^");
        pushUpButton.setToolTipText("Push Up");
        pushUpButton.setMargin(new Insets(4, 4, 0, 3));
        pushUpButton.addActionListener((ActionEvent e) -> {
            int[] rows = table.getSelectedRows();
            if (rows.length > 0 && rows[0] > 0) {
                opcodeList.pushUpUDO(rows);

                table.setRowSelectionInterval(rows[0] - 1,
                        rows[rows.length - 1] - 1);
            }
        });

        JButton pushDownButton = new JButton("V");
        pushDownButton.setMargin(new Insets(2, 3, 0, 4));
        pushDownButton.setToolTipText("Push Down");
        pushDownButton.addActionListener((ActionEvent e) -> {
            int[] rows = table.getSelectedRows();
            if (rows.length > 0
                    && rows[rows.length - 1] < (opcodeList.size() - 1)) {
                opcodeList.pushDownUDO(rows);

                table.setRowSelectionInterval(rows[0] + 1,
                        rows[rows.length - 1] + 1);
            }
        });

        JPanel buttonPanel = new JPanel();
        buttonPanel.setPreferredSize(new Dimension(30, 100));

        buttonPanel.add(addButton);
        buttonPanel.add(importButton);
        buttonPanel.add(removeButton);
        buttonPanel.add(pushUpButton);
        buttonPanel.add(pushDownButton);

        this.setLayout(new BorderLayout());

        this.add(label, BorderLayout.NORTH);
        this.add(buttonPanel, BorderLayout.WEST);
        this.add(new JScrollPane(table), BorderLayout.CENTER);

        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (table.isEditing()) {
                    return;
                }

                if (UiUtilities.isRightMouseButton(e)) {
                    popup.show(table, e.getX(), e.getY());
                }
            }
        });

        new OpcodeListDragSource(table, DnDConstants.ACTION_COPY);
        new OpcodeListDropTarget(table);

        File defaultFile = new File(GeneralSettings.getInstance()
                .getDefaultDirectory()
                + File.separator + "default.blueUDO");

        File defaultCsoundUdoFile = new File(GeneralSettings.getInstance()
                .getDefaultDirectory()
                + File.separator + "default.udo");

        final FileChooserManager fcm = FileChooserManager.getDefault();

        fcm.addFilter(IMPORT_BLUE_UDO_DIALOG,
                new FileNameExtensionFilter("Blue UDO File", "blueUDO"));
        fcm.setDialogTitle(IMPORT_BLUE_UDO_DIALOG, "Import Blue User-Defined Opcode");
        fcm.setSelectedFile(IMPORT_BLUE_UDO_DIALOG, defaultFile);

        fcm.addFilter(IMPORT_CSOUND_UDO_DIALOG,
                new FileNameExtensionFilter("Csound File",  "udo", "orc", "csd"));
        fcm.setDialogTitle(IMPORT_CSOUND_UDO_DIALOG, "Import Csound User-Defined Opcodes");
        fcm.setSelectedFile(IMPORT_CSOUND_UDO_DIALOG, defaultCsoundUdoFile);
    }

    public void setTopBarVisible(boolean visible) {
        label.setVisible(visible);
    }

    public void deselect() {
        table.clearSelection();
    }

    /**
     *
     */
//    protected void importUDO() {
//        if (opcodeList == null) {
//            return;
//        }
//
//        if (browser == null) {
//            browser = new UDORepositoryBrowser((Window) SwingUtilities
//                    .getRoot(this));
//        }
//
//        browser.setOpcodeList(opcodeList);
//        browser.setVisible(true);
//        browser.refreshCategoriesList();
//    }
    public void addListSelectionListener(ListSelectionListener listener) {
        table.getSelectionModel().addListSelectionListener(listener);
    }

    /**
     *
     */
    protected void removeUDO() {
        if (opcodeList == null) {
            return;
        }

        int[] indexes = table.getSelectedRows();

        if (indexes.length > 0) {
            opcodeList.removeOpcodes(indexes);
        }
    }

    /**
     *
     */
    protected void addUDO() {
        if (opcodeList != null) {
            UserDefinedOpcode udo = new UserDefinedOpcode();
            udo.opcodeName += opcodeList.size();

            opcodeList.addOpcode(udo);
        }
    }

    public void addUDO(UserDefinedOpcode udo) {
        if (opcodeList != null) {
            opcodeList.addOpcode(udo);
        }
    }

    private void addUDO(UserDefinedOpcode udo, int row) {
        if (opcodeList != null) {
            opcodeList.addOpcode(row, udo);
        }
    }

    public void setOpcodeList(OpcodeList opcodeList) {
        if (opcodeList == null) {
            this.setVisible(false);
            return;
        }

        this.setVisible(true);

        table.setModel(opcodeList);
        this.opcodeList = opcodeList;

        if (browser != null && browser.isVisible()) {
            browser.setOpcodeList(opcodeList);
        }
    }

    /**
     * @return
     */
    public UserDefinedOpcode[] getSelectedUDOs() {
        int[] indexes = table.getSelectedRows();

        if (indexes.length == 0) {
            return null;
        }

        UserDefinedOpcode[] udos = new UserDefinedOpcode[indexes.length];
        for (int i = 0; i < indexes.length; i++) {
            udos[i] = opcodeList.getOpcode(indexes[i]);
        }
        return udos;
    }

    protected void cutUDO() {
        if (getSelectedUDOs() != null) {
            copyUDO();
            removeUDO();
        }

    }

    protected void copyUDO() {
        UserDefinedOpcode[] udos = getSelectedUDOs();
        if (udos != null) {

            UserDefinedOpcode[] copies = new UserDefinedOpcode[udos.length];

            for (int i = 0; i < udos.length; i++) {
                copies[i] = new UserDefinedOpcode(udos[i]);
            }

            UDOBuffer.getInstance().setBufferedObject(
                    copies);
        }
    }

    protected void pasteUDO() {
        UDOBuffer buffer = UDOBuffer.getInstance();
        Object obj = buffer.getBufferedObject();

        if (obj == null) {
            return;
        }
        handlePaste(obj);

    }

    private void handlePaste(Object obj) {
        if (obj instanceof UserDefinedOpcode) {

            opcodeList.addOpcode(new UserDefinedOpcode((UserDefinedOpcode) obj));

        } else if (obj instanceof UserDefinedOpcode[]) {

            UserDefinedOpcode[] udos = (UserDefinedOpcode[]) obj;

            UserDefinedOpcode[] copies = new UserDefinedOpcode[udos.length];

            for (int i = 0; i < udos.length; i++) {
                copies[i] = new UserDefinedOpcode(udos[i]);
            }

            opcodeList.addOpcodes(copies);
        } else if (obj instanceof UDOCategory) {
            UDOCategory cat = (UDOCategory) obj;

            ArrayList<UserDefinedOpcode> udos = cat.getAllUserDefinedOpcodes();

            UserDefinedOpcode[] copies = new UserDefinedOpcode[udos.size()];

            for (int i = 0; i < udos.size(); i++) {
                copies[i] = new UserDefinedOpcode(udos.get(i));
            }

            opcodeList.addOpcodes(copies);
        }
    }

    protected void exportCsoundUdo() {
        UserDefinedOpcode[] selected = getSelectedUDOs();

        if (selected == null || selected.length != 1) {
            return;
        }

        File retVal = FileChooserManager.getDefault().showSaveDialog(
                EXPORT_CSOUND_UDO_DIALOG,
                SwingUtilities.getRoot(OpcodeListEditPanel.this));

        if (retVal != null) {

            File f = retVal;

            if (f.exists()) {
                int overWrite = JOptionPane
                        .showConfirmDialog(
                                SwingUtilities
                                        .getRoot(OpcodeListEditPanel.this),
                                "Please confirm you would like to overwrite this file.");

                if (overWrite != JOptionPane.OK_OPTION) {
                    return;
                }
            }

            String udoText = selected[0].generateCode();

            try (PrintWriter out = new PrintWriter(new FileWriter(f))) {
                out.print(udoText);
            } catch (IOException ex) {
                ex.printStackTrace();
            }

        }
    }

    protected void exportBlueUdo() {
        UserDefinedOpcode[] selected = getSelectedUDOs();

        if (selected == null || selected.length != 1) {
            return;
        }

        File retVal = FileChooserManager.getDefault().showSaveDialog(
                EXPORT_BLUE_UDO_DIALOG,
                SwingUtilities.getRoot(OpcodeListEditPanel.this));

        if (retVal != null) {

            File f = retVal;

            if (f.exists()) {
                int overWrite = JOptionPane
                        .showConfirmDialog(
                                SwingUtilities
                                        .getRoot(OpcodeListEditPanel.this),
                                "Please confirm you would like to overwrite this file.");

                if (overWrite != JOptionPane.OK_OPTION) {
                    return;
                }
            }

            Element node = selected[0].saveAsXML();

            try (PrintWriter out = new PrintWriter(new FileWriter(f))) {
                out.print(node.toString());
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
    }

    protected void importBlueUdo() {

        List<File> retVal = FileChooserManager.getDefault().showOpenDialog(
                IMPORT_BLUE_UDO_DIALOG,
                SwingUtilities.getRoot(OpcodeListEditPanel.this));

        if (retVal != null && retVal.size() == 1) {

            File f = retVal.get(0);

            if (f.exists()) {
                try {
                    String text = TextUtilities.getTextFromFile(f);
                    Document d = new Document(f);
                    UserDefinedOpcode udo = UserDefinedOpcode.loadFromXML(d.getRoot());
                    opcodeList.addOpcode(udo);
                } catch (Exception ex) {
                    Exceptions.printStackTrace(ex);
                }
            }

        }
    }

    protected void importCsoundUdo() {
        List<File> retVal = FileChooserManager.getDefault().showOpenDialog(
                IMPORT_CSOUND_UDO_DIALOG,
                SwingUtilities.getRoot(OpcodeListEditPanel.this));

        if (retVal != null && retVal.size() == 1) {

            File f = retVal.get(0);

            if (f.exists()) {
                try {
                    String text = TextUtilities.getTextFromFile(f);
                    OpcodeList opList = UDOUtilities.parseUDOText(text);
                    opcodeList.addAll(opList);
                } catch (Exception ex) {
                    Exceptions.printStackTrace(ex);
                }
            }

        }
    }

    class UDOPopup extends JPopupMenu {

        public UDOPopup() {
            JMenuItem cut = new JMenuItem();
            cut.setText(BlueSystem.getString("common.cut"));
            cut.addActionListener((ActionEvent ae) -> {
                cutUDO();
            });

            JMenuItem copy = new JMenuItem();
            copy.setText(BlueSystem.getString("common.copy"));
            copy.addActionListener((ActionEvent ae) -> {
                copyUDO();
            });

            final JMenuItem paste = new JMenuItem();
            paste.setText(BlueSystem.getString("common.paste"));
            paste.addActionListener((ActionEvent ae) -> {
                pasteUDO();
            });

            final JMenu export = new JMenu("Export");

            final JMenuItem exportBlueUdo = new JMenuItem();
            exportBlueUdo.setText("Blue UDO");
            exportBlueUdo.addActionListener((ActionEvent ae) -> {
                exportBlueUdo();
            });

            final JMenuItem exportCsoundUdo = new JMenuItem();
            exportCsoundUdo.setText("Csound UDO");
            exportCsoundUdo.addActionListener((ActionEvent ae) -> {
                exportCsoundUdo();
            });

            export.add(exportBlueUdo);
            export.add(exportCsoundUdo);

            this.add(cut);
            this.add(copy);
            this.add(paste);
            this.addSeparator();
            this.add(export);

            this.addPopupMenuListener(new PopupMenuListener() {

                @Override
                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    UDOBuffer buffer = UDOBuffer.getInstance();
                    Object obj = buffer.getBufferedObject();

                    paste.setEnabled(obj != null
                            && (obj instanceof UserDefinedOpcode[]
                            || obj instanceof UserDefinedOpcode
                            || obj instanceof UDOCategory));

                    UserDefinedOpcode[] selected = getSelectedUDOs();
                    export.setEnabled(selected != null && selected.length == 1);
                }

                @Override
                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuCanceled(PopupMenuEvent e) {
                }

            });

            File defaultFile = new File(GeneralSettings.getInstance()
                    .getDefaultDirectory()
                    + File.separator + "default.blueUDO");

            File defaultCsoundUdoFile = new File(GeneralSettings.getInstance()
                    .getDefaultDirectory()
                    + File.separator + "default.udo");

            final FileChooserManager fcm = FileChooserManager.getDefault();

            fcm.addFilter(EXPORT_BLUE_UDO_DIALOG,
                    new FileNameExtensionFilter("Blue UDO File", "blueUDO"));
            fcm.setDialogTitle(EXPORT_BLUE_UDO_DIALOG, "Export Blue User-Defined Opcode");
            fcm.setSelectedFile(EXPORT_BLUE_UDO_DIALOG, defaultFile);

            fcm.addFilter(EXPORT_CSOUND_UDO_DIALOG,
                    new FileNameExtensionFilter("Csound UDO File", "udo", "inc"));
            fcm.setDialogTitle(EXPORT_CSOUND_UDO_DIALOG, "Export Csound User-Defined Opcode");
            fcm.setSelectedFile(EXPORT_CSOUND_UDO_DIALOG, defaultCsoundUdoFile);
        }

    }

    static class OpcodeListDragSource extends DragSourceAdapter implements
            DragGestureListener {

        DragSource source;

        DragGestureRecognizer recognizer;

        JTable table;

        TransferableUDO transferable;

        // Object oldNode;
        public OpcodeListDragSource(JTable table, int actions) {
            this.table = table;
            source = new DragSource();
            recognizer = source.createDefaultDragGestureRecognizer(table,
                    actions, this);
        }

        @Override
        public void dragGestureRecognized(DragGestureEvent dge) {
            int index = table.getSelectedRow();
            if (index < 0) {
                return;
            }

            OpcodeList opcodeList = (OpcodeList) table.getModel();

            UserDefinedOpcode udo = opcodeList.getOpcode(index);

            Object cloneNode = new UserDefinedOpcode(udo);

            transferable = new TransferableUDO(cloneNode);
            source.startDrag(dge, null, transferable, this);
            DragManager.setDragSource(table);
        }

        @Override
        public void dragDropEnd(DragSourceDropEvent dsde) {
            DragManager.setDragSource(null);

        }

    }

    class OpcodeListDropTarget extends DropTargetAdapter {

        DropTarget target;

        JTable targetTable;

        public OpcodeListDropTarget(JTable table) {
            targetTable = table;
            target = new DropTarget(targetTable, this);
        }

        @Override
        public void dragEnter(DropTargetDragEvent dtde) {

            if (!dtde.isDataFlavorSupported(TransferableUDO.UDO_FLAVOR)
                    && !dtde.isDataFlavorSupported(TransferableUDO.UDO_CAT_FLAVOR)) {
                dtde.rejectDrag();
                return;
            }

            if (DragManager.getDragSource() != targetTable) {
                dtde.acceptDrag(DnDConstants.ACTION_COPY);

            } else {
                dtde.rejectDrag();
            }

        }

        @Override
        public void dragOver(DropTargetDragEvent dtde) {
            dragEnter(dtde);
        }

        @Override
        public void drop(DropTargetDropEvent dtde) {
            Point pt = dtde.getLocation();

            if (!(dtde.isDataFlavorSupported(TransferableUDO.UDO_FLAVOR)
                    || dtde.isDataFlavorSupported(TransferableUDO.UDO_CAT_FLAVOR))
                    || ((dtde.getSourceActions() & DnDConstants.ACTION_COPY) != DnDConstants.ACTION_COPY)) {
                dtde.rejectDrop();
                return;
            }

            try {
                Transferable tr = dtde.getTransferable();

                Object transferNode = tr
                        .getTransferData(TransferableUDO.UDO_FLAVOR);

                dtde.acceptDrop(DnDConstants.ACTION_COPY);

                handlePaste(transferNode);

                dtde.dropComplete(true);

            } catch (UnsupportedFlavorException | IOException e) {
                e.printStackTrace();
            }
        }
    }
}
