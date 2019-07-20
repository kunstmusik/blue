/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@csounds.com)
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
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.udo.UDOCategory;
import blue.udo.UDOLibrary;
import blue.udo.UserDefinedOpcode;
import blue.ui.core.orchestra.UserInstrumentLibrary;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Point;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.BorderFactory;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTree;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.ToolTipManager;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.tree.TreePath;
import javax.swing.tree.TreeSelectionModel;

/**
 * @author steven
 */
public class UDOLibraryPanel extends JComponent {

    // private static MessageFormat toolTipFormat = new MessageFormat(
    // "<html><b>Instrument Type:</b> {0}</html>");

    private static final UDOTreePopup popup = new UDOTreePopup();

    public UDOLibrary iLibrary = null;

    JTree libraryTree = new JTree();

    ArrayList<SelectionListener> listeners = new ArrayList<>();

    public UDOLibraryPanel() {
        this.setLayout(new BorderLayout());

        JLabel label = new JLabel("User-Defined Opcode Library");

        this.add(label, BorderLayout.NORTH);

        label.setMinimumSize(new Dimension(0, 0));
        label.setBorder(BorderFactory.createCompoundBorder(BorderFactory
                .createBevelBorder(BevelBorder.RAISED), new EmptyBorder(3, 3,
                3, 3)));

        JScrollPane libraryScroll = new JScrollPane(libraryTree);

        libraryScroll.setBorder(null);
        libraryScroll.setMinimumSize(new Dimension(0, 0));

        this.add(libraryScroll, BorderLayout.CENTER);

        // new DropTarget(libraryTree, new TreeHilightDropListener());
        libraryTree.setEditable(true);
        ToolTipManager.sharedInstance().registerComponent(libraryTree);

        // libraryTree.setCellRenderer(new DefaultTreeCellRenderer() {
        //
        // public Component getTreeCellRendererComponent(JTree tree,
        // Object value, boolean sel, boolean expanded, boolean leaf,
        // int row, boolean hasFocus) {
        //
        // super.getTreeCellRendererComponent(tree, value, sel, expanded,
        // leaf, row, hasFocus);
        //
        // if (value instanceof Instrument) {
        //
        // Object[] args = { ObjectUtilities.getShortClassName(value) };
        //
        // String tip = toolTipFormat.format(args);
        // setToolTipText(tip);
        // } else {
        // setToolTipText(null); // no tool tip
        // }
        //
        // return this;
        // }
        // });

        new UDOTreeDragSource(libraryTree, DnDConstants.ACTION_COPY_OR_MOVE);
        new UDOTreeDropTarget(libraryTree);

        libraryTree.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {

                TreePath path = libraryTree.getSelectionPath();
                if (path == null) {
                    return;
                }

                Object userObject = path.getLastPathComponent();

                if (UiUtilities.isRightMouseButton(e)) {
                                        Point p = e.getPoint();
                     p = SwingUtilities.convertPoint(libraryTree, p,
                            UDOLibraryPanel.this);
                    showPopup(userObject, p.x, p.y);
                } else {
                    SelectionEvent se = new SelectionEvent(userObject,
                            SelectionEvent.SELECTION_SINGLE);

                    fireSelected(se);
                }
            }

        });

        InputMap inputMap = libraryTree.getInputMap(WHEN_FOCUSED);

        ActionMap actionMap = libraryTree.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_X, BlueSystem
                .getMenuShortcutKey()), "cutNode");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_C, BlueSystem
                .getMenuShortcutKey()), "copyNode");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_V, BlueSystem
                .getMenuShortcutKey()), "pasteNode");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DELETE, 0),
                "deleteNode");

        actionMap.put("cutNode", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                cutNode();
            }
        });

        actionMap.put("copyNode", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                copyNode();
            }
        });

        actionMap.put("pasteNode", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                pasteNode();
            }
        });

        actionMap.put("deleteNode", new AbstractAction() {

            @Override
            public void actionPerformed(ActionEvent e) {
                deleteNode();
            }
        });

        libraryTree.getSelectionModel().setSelectionMode(
                TreeSelectionModel.SINGLE_TREE_SELECTION);

        iLibrary = BlueSystem.getUDOLibrary();

        libraryTree.setModel(iLibrary);
    }

    public void addSelectionListener(SelectionListener listener) {
        listeners.add(listener);
    }

    public void removeSelectionListener(SelectionListener listener) {
        listeners.remove(listener);
    }

    public void fireSelected(SelectionEvent se) {
        for (SelectionListener listener : listeners) {
            listener.selectionPerformed(se);
        }
    }

    protected void cutNode() {
        TreePath path = libraryTree.getSelectionPath();
        if (path == null) {
            return;
        }

        Object userObj = path.getLastPathComponent();

        popup.setInstrumentGUI(this);
        popup.setUserObj(userObj);

        popup.cutNode();

    }

    protected void copyNode() {
        TreePath path = libraryTree.getSelectionPath();
        if (path == null) {
            return;
        }

        Object userObj = path.getLastPathComponent();

        popup.setInstrumentGUI(this);
        popup.setUserObj(userObj);

        popup.copyNode();

    }

    protected void pasteNode() {
        TreePath path = libraryTree.getSelectionPath();
        if (path == null) {
            return;
        }

        Object userObj = path.getLastPathComponent();

        popup.setInstrumentGUI(this);
        popup.setUserObj(userObj);

        popup.pasteNode();

    }

    protected void deleteNode() {
        TreePath path = libraryTree.getSelectionPath();
        if (path == null) {
            return;
        }

        Object userObj = path.getLastPathComponent();

        popup.setInstrumentGUI(this);
        popup.setUserObj(userObj);

        popup.deleteNode();
    }

    private void showPopup(Object userObj, int x, int y) {
        popup.show(this, userObj, x, y);
    }

    public void removeUDO(UserDefinedOpcode udo) {
        iLibrary.removeUDO(udo);
    }

    public UserDefinedOpcode getSelectedUDO() {
        TreePath selectionPath = libraryTree.getSelectionPath();

        if (selectionPath == null) {
            return null;
        }

        Object obj = selectionPath.getLastPathComponent();
        if (obj instanceof UserDefinedOpcode) {
            return (UserDefinedOpcode) obj;
        }
        return null;
    }

    public static void main(String[] args) {
        GUI.showComponentAsStandalone(new UDOLibraryPanel(), "UDO Library",
                true);
    }

    public void deselect() {
        libraryTree.clearSelection();
    }

}

class UDOTreePopup extends JPopupMenu {

    Object userObj;

    UDOLibraryPanel instrGUI;

    JMenuItem addCategoryMenuItem = new JMenuItem(BlueSystem
            .getString("codeRepository.addGroup"));

    JMenuItem removeCategoryMenuItem = new JMenuItem(BlueSystem
            .getString("codeRepository.removeGroup"));

    JMenuItem addInstrumentMenu;

    JMenuItem removeInstrumentMenuItem = new JMenuItem(BlueSystem
            .getString("common.remove"));

    JMenuItem cutMenuItem = new JMenuItem(BlueSystem
            .getString("instrument.cut"));

    JMenuItem copyMenuItem = new JMenuItem(BlueSystem
            .getString("instrument.copy"));

    JMenuItem pasteMenuItem = new JMenuItem(BlueSystem
            .getString("instrument.paste"));

    Separator sep = new Separator();

    public UDOTreePopup() {

        addCategoryMenuItem.addActionListener((ActionEvent e) -> {
            addUDOCategory();
        });
        removeCategoryMenuItem.addActionListener((ActionEvent e) -> {
            removeUDOCategory();
        });
        removeInstrumentMenuItem.addActionListener((ActionEvent e) -> {
            removeUDO();
        });
        cutMenuItem.addActionListener((ActionEvent e) -> {
            cutNode();
        });
        copyMenuItem.addActionListener((ActionEvent e) -> {
            copyNode();
        });
        pasteMenuItem.addActionListener((ActionEvent e) -> {
            pasteNode();
        });

        addInstrumentMenu = getAddUDOMenu();

        this.add(addCategoryMenuItem);
        this.add(removeCategoryMenuItem);

        this.add(sep);

        this.add(addInstrumentMenu);
        this.add(removeInstrumentMenuItem);

        this.addSeparator();

        this.add(cutMenuItem);
        this.add(copyMenuItem);
        this.add(pasteMenuItem);

    }

    public void setUserObj(Object obj) {
        this.userObj = obj;
    }

    public void setInstrumentGUI(UDOLibraryPanel instrGUI) {
        this.instrGUI = instrGUI;
    }

    protected void cutNode() {
        if (userObj == instrGUI.iLibrary.getRoot() || userObj == null) {
            return;
        }

        copyNode();
        deleteNode();

    }

    protected void deleteNode() {
        if (userObj == instrGUI.iLibrary.getRoot()) {
            return;
        }

        if (userObj instanceof UserDefinedOpcode) {
            removeUDO();
        } else {
            removeUDOCategory();
        }
    }

    protected void copyNode() {
        if (userObj == instrGUI.iLibrary.getRoot()) {
            return;
        }

        Object bufObj;
        if (userObj instanceof UserDefinedOpcode) {
            bufObj = new UserDefinedOpcode((UserDefinedOpcode) userObj);
        } else {
            bufObj = new UDOCategory((UDOCategory) userObj); 
        }

        UDOBuffer.getInstance().setBufferedObject(bufObj);
    }

    protected void pasteNode() {
        Object bufferedObj = UDOBuffer.getInstance().getBufferedObject();

        if (userObj instanceof UserDefinedOpcode || bufferedObj == null) {
            return;
        }

        if (bufferedObj instanceof UserDefinedOpcode) {
            addUDO((UserDefinedOpcode) bufferedObj);
        } else if(bufferedObj instanceof UserDefinedOpcode[]) {
            for(UserDefinedOpcode udo : (UserDefinedOpcode[])bufferedObj) {
                addUDO(udo);
            }
        } else {
            addUDOCategory(new UDOCategory((UDOCategory) bufferedObj));
        }
    }

    private void addUDOCategory() {
        UDOCategory newCategory = new UDOCategory();

        addUDOCategory(newCategory);
    }

    private void addUDOCategory(UDOCategory iCategory) {
        if (userObj instanceof UserDefinedOpcode) {
            return;
        }

        instrGUI.iLibrary.addCategory((UDOCategory) userObj, iCategory);

    }

    private void removeUDOCategory() {
        UDOCategory category = (UDOCategory) userObj;

        instrGUI.iLibrary.removeCategory(category);
    }

    private void addUDO() {
        UserDefinedOpcode newUDO = new UserDefinedOpcode();

        UDOCategory currentCategory = (UDOCategory) userObj;

        instrGUI.iLibrary.addUDO(currentCategory, newUDO);

        /*
         * BlueUndoManager.setUndoManager("orchestra"); BlueUndoManager.addEdit(
         * new AddEdit(orchTableModel, clone, new Integer(iNum)));
         */
    }

    private void addUDO(UserDefinedOpcode udo) {
        UserDefinedOpcode newUDO = new UserDefinedOpcode(udo);

        UDOCategory currentCategory = (UDOCategory) userObj;

        instrGUI.iLibrary.addUDO(currentCategory, newUDO);

        /*
         * BlueUndoManager.setUndoManager("orchestra"); BlueUndoManager.addEdit(
         * new AddEdit(orchTableModel, clone, new Integer(iNum)));
         */
    }

    private void removeUDO() {
        UserDefinedOpcode udo = (UserDefinedOpcode) userObj;
        instrGUI.removeUDO(udo);
    }

    public void show(UDOLibraryPanel instrGui, Object userObj, int x, int y) {
        this.instrGUI = instrGui;
        this.userObj = userObj;

        if (userObj instanceof UDOCategory) {
            addCategoryMenuItem.setVisible(true);

            if (((UDOCategory) userObj).isRoot()) {
                removeCategoryMenuItem.setVisible(false);
            } else {
                removeCategoryMenuItem.setVisible(true);
            }

            addInstrumentMenu.setVisible(true);
            removeInstrumentMenuItem.setVisible(false);

            sep.setVisible(true);

            // pasteMenuItem.setVisible(true);
            // pasteMenuItem.setEnabled((bufferedInstrument != null));

            // setInstrumentMenuEnabled(false);
        } else {
            addCategoryMenuItem.setVisible(false);
            removeCategoryMenuItem.setVisible(false);
            addInstrumentMenu.setVisible(false);
            removeInstrumentMenuItem.setVisible(true);

            sep.setVisible(false);

            // pasteMenuItem.setVisible(false);

            // setInstrumentMenuEnabled(true);
        }

        setBufferMenuItems();

        super.show(instrGui, x, y);
    }

    private void setBufferMenuItems() {
        Object bufferedObj = UDOBuffer.getInstance().getBufferedObject();

        pasteMenuItem.setEnabled(bufferedObj != null);

        if (userObj instanceof UDOCategory && ((UDOCategory) userObj).isRoot()) {
            cutMenuItem.setEnabled(false);
            copyMenuItem.setEnabled(false);
        } else {
            cutMenuItem.setEnabled(true);
            copyMenuItem.setEnabled(true);
        }

        cutMenuItem.setText(BlueSystem.getString("common.cut"));
        copyMenuItem.setText(BlueSystem.getString("common.copy"));
        pasteMenuItem.setText(BlueSystem.getString("common.paste"));
    }

    private JMenuItem getAddUDOMenu() {
        JMenuItem instrumentMenu = new JMenuItem("Add User-Defined Opcode");

        instrumentMenu.addActionListener((ActionEvent ae) -> {
            addUDO();
        });

        return instrumentMenu;
    }
}