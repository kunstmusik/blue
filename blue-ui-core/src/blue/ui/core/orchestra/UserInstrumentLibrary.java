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
package blue.ui.core.orchestra;

import blue.BlueSystem;
import blue.InstrumentLibrary;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.orchestra.Instrument;
import blue.orchestra.InstrumentCategory;
import blue.ui.core.BluePluginManager;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.ObjectUtilities;
import electric.xml.Document;
import electric.xml.Element;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Point;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.BorderFactory;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTree;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.ToolTipManager;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;
import javax.swing.tree.DefaultTreeCellRenderer;
import javax.swing.tree.TreePath;
import javax.swing.tree.TreeSelectionModel;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.Exceptions;

/**
 * @author steven
 */
public class UserInstrumentLibrary extends JComponent {

    private static MessageFormat toolTipFormat = new MessageFormat(
            "<html><b>Instrument Type:</b> {0}</html>");

    private static final UserInstrumentTreePopup popup = new UserInstrumentTreePopup();

    public InstrumentLibrary iLibrary = null;

    JTree libraryTree = new JTree();

    ArrayList listeners = new ArrayList();

    public UserInstrumentLibrary() {
        this.setLayout(new BorderLayout());

        JLabel label = new JLabel("User Instrument Library");

        this.add(label, BorderLayout.NORTH);

        label.setMinimumSize(new Dimension(0, 0));
        label.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createBevelBorder(BevelBorder.RAISED),
                new EmptyBorder(3, 3,
                        3, 3)));

        JScrollPane libraryScroll = new JScrollPane(libraryTree);

        libraryScroll.setBorder(null);
        libraryScroll.setMinimumSize(new Dimension(0, 0));

        this.add(libraryScroll, BorderLayout.CENTER);

        // new DropTarget(libraryTree, new TreeHilightDropListener());
        libraryTree.setEditable(true);
        ToolTipManager.sharedInstance().registerComponent(libraryTree);

        libraryTree.setCellRenderer(new DefaultTreeCellRenderer() {

            @Override
            public Component getTreeCellRendererComponent(JTree tree,
                    Object value, boolean sel, boolean expanded, boolean leaf,
                    int row, boolean hasFocus) {

                super.getTreeCellRendererComponent(tree, value, sel, expanded,
                        leaf, row, hasFocus);

                if (value instanceof Instrument) {

                    Object[] args = {ObjectUtilities.getShortClassName(value)};

                    String tip = toolTipFormat.format(args);
                    setToolTipText(tip);
                } else {
                    setToolTipText(null); // no tool tip
                }

                return this;
            }
        });

        new InstrumentTreeDragSource(libraryTree,
                DnDConstants.ACTION_COPY_OR_MOVE);
        new InstrumentTreeDropTarget(libraryTree);

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
                            UserInstrumentLibrary.this);

                    showPopup(userObject, (int) p.getX(), (int) p.getY());
                } else {
                    SelectionEvent se = new SelectionEvent(userObject,
                            SelectionEvent.SELECTION_SINGLE);

                    fireSelected(se);
                }
            }
        });

        InputMap inputMap = libraryTree.getInputMap(WHEN_FOCUSED);

        ActionMap actionMap = libraryTree.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_X,
                BlueSystem.getMenuShortcutKey()), "cutNode");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_C,
                BlueSystem.getMenuShortcutKey()), "copyNode");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_V,
                BlueSystem.getMenuShortcutKey()), "pasteNode");

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

        iLibrary = BlueSystem.getUserInstrumentLibrary();

        libraryTree.setModel(iLibrary);
    }

    public void addSelectionListener(SelectionListener listener) {
        listeners.add(listener);
    }

    public void removeSelectionListener(SelectionListener listener) {
        listeners.remove(listener);
    }

    public void fireSelected(SelectionEvent se) {

        for (int i = 0; i < listeners.size(); i++) {
            SelectionListener listener = (SelectionListener) listeners.get(i);
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

    public void removeInstrument(Instrument instr) {
        iLibrary.removeInstrument(instr);
    }

    public Instrument getSelectedInstrument() {
        TreePath selectionPath = libraryTree.getSelectionPath();

        if (selectionPath == null) {
            return null;
        }

        Object obj = selectionPath.getLastPathComponent();
        if (obj instanceof Instrument) {
            return (Instrument) obj;
        }
        return null;
    }

//    public static void main(String[] args) {
//        GUI.showComponentAsStandalone(new UserInstrumentLibrary(),
//                "User Instrument Library", true);
//    }
    public void deselect() {
        libraryTree.clearSelection();
    }
}

class UserInstrumentTreePopup extends JPopupMenu {

    private static final String IMPORT_DIALOG = "instr.import";

    private static final String EXPORT_DIALOG = "instr.export";

    Object userObj;

    Object bufferedObj;

    UserInstrumentLibrary instrGUI;

    JMenuItem addCategoryMenuItem = new JMenuItem(BlueSystem.getString(
            "codeRepository.addGroup"));

    JMenuItem removeCategoryMenuItem = new JMenuItem(BlueSystem.getString(
            "codeRepository.removeGroup"));

    JMenu addInstrumentMenu;

    JMenuItem removeInstrumentMenuItem = new JMenuItem(BlueSystem.getString(
            "instrument.remove"));

    JMenuItem cutMenuItem = new JMenuItem(BlueSystem.getString("instrument.cut"));

    JMenuItem copyMenuItem = new JMenuItem(BlueSystem.getString(
            "instrument.copy"));

    JMenuItem pasteMenuItem = new JMenuItem(BlueSystem.getString(
            "instrument.paste"));

    Separator sep = new Separator();

    Action importItem, exportItem;

    public UserInstrumentTreePopup() {

        addCategoryMenuItem.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                addInstrumentCategory();
            }
        });
        removeCategoryMenuItem.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                removeInstrumentCategory();
            }
        });
        removeInstrumentMenuItem.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                removeInstrument();
            }
        });
        cutMenuItem.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                cutNode();
            }
        });
        copyMenuItem.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                copyNode();
            }
        });
        pasteMenuItem.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                pasteNode();
            }
        });

        importItem = new AbstractAction(BlueSystem.getString("common.import")) {

            @Override
            public void actionPerformed(ActionEvent e) {

                int retVal = FileChooserManager.getDefault().showOpenDialog(
                        IMPORT_DIALOG,
                        SwingUtilities.getRoot(instrGUI));

                if (retVal == JFileChooser.APPROVE_OPTION) {

                    File f = FileChooserManager.getDefault().getSelectedFile(
                            IMPORT_DIALOG);
                    Document doc;

                    try {
                        doc = new Document(f);
                        Element root = doc.getRoot();
                        if (root.getName().equals("instrument")) {
                            Instrument tempInstr = (Instrument) ObjectUtilities.loadFromXML(
                                    root);
                            addInstrument(tempInstr);
                        } else {
                            JOptionPane.showMessageDialog(
                                    SwingUtilities.getRoot(instrGUI),
                                    "Error: File did not contain instrument",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                        }

                    } catch (Exception ex) {
                        ex.printStackTrace();
                        JOptionPane.showMessageDialog(SwingUtilities.getRoot(
                                instrGUI),
                                "Error: Could not read instrument from file",
                                "Error", JOptionPane.ERROR_MESSAGE);
                    }

                }

            }
        };

        exportItem = new AbstractAction(BlueSystem.getString("common.export")) {

            @Override
            public void actionPerformed(ActionEvent e) {
                if (userObj == null || !(userObj instanceof Instrument)) {
                    return;
                }

                int retVal = FileChooserManager.getDefault().showSaveDialog(
                        EXPORT_DIALOG,
                        SwingUtilities.getRoot(instrGUI));

                if (retVal == JFileChooser.APPROVE_OPTION) {

                    File f = FileChooserManager.getDefault().getSelectedFile(
                            EXPORT_DIALOG);

                    if (f.exists()) {
                        int overWrite = JOptionPane.showConfirmDialog(
                                SwingUtilities.getRoot(instrGUI),
                                "Please confirm you would like to overwrite this file.");

                        if (overWrite != JOptionPane.OK_OPTION) {
                            return;
                        }
                    }

                    Element node = ((Instrument) userObj).saveAsXML();

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
        };

        addInstrumentMenu = getAddInstrumentMenu();

        this.add(addCategoryMenuItem);
        this.add(removeCategoryMenuItem);

        this.add(sep);

        this.add(addInstrumentMenu);
        this.add(removeInstrumentMenuItem);

        this.addSeparator();

        this.add(cutMenuItem);
        this.add(copyMenuItem);
        this.add(pasteMenuItem);

        this.addSeparator();
        this.add(importItem);
        this.add(exportItem);

    }

    public void setUserObj(Object obj) {
        this.userObj = obj;
    }

    public void setInstrumentGUI(UserInstrumentLibrary instrGUI) {
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

        if (userObj instanceof Instrument) {
            removeInstrument();
        } else {
            removeInstrumentCategory();
        }
    }

    protected void copyNode() {
        if (userObj == instrGUI.iLibrary.getRoot()) {
            return;
        }

        if (userObj instanceof Instrument) {
            bufferedObj = ((Instrument) userObj).clone();
        } else {
            bufferedObj = ObjectUtilities.clone(userObj);
        }
    }

    protected void pasteNode() {
        if (userObj instanceof Instrument) {
            return;
        }

        if (bufferedObj instanceof Instrument) {
            addInstrument((Instrument) bufferedObj);
        } else {
            addInstrumentCategory((InstrumentCategory) ObjectUtilities.clone(
                    bufferedObj));
        }
    }

    private void addInstrumentCategory() {
        InstrumentCategory newCategory = new InstrumentCategory();

        addInstrumentCategory(newCategory);
    }

    private void addInstrumentCategory(InstrumentCategory iCategory) {
        if (userObj instanceof Instrument) {
            return;
        }

        instrGUI.iLibrary.addCategory((InstrumentCategory) userObj, iCategory);

    }

    private void removeInstrumentCategory() {
        InstrumentCategory category = (InstrumentCategory) userObj;

        instrGUI.iLibrary.removeCategory(category);
    }

    private void addInstrument(Instrument instr) {
        Instrument newInstrument = (Instrument) instr.clone();

        InstrumentCategory currentCategory = (InstrumentCategory) userObj;

        instrGUI.iLibrary.addInstrument(currentCategory, newInstrument);

        /*
         * BlueUndoManager.setUndoManager("orchestra"); BlueUndoManager.addEdit(
         * new AddEdit(orchTableModel, clone, new Integer(iNum)));
         */
    }

    private void removeInstrument() {
        Instrument instrument = (Instrument) userObj;
        instrGUI.removeInstrument(instrument);
    }

    public void show(UserInstrumentLibrary instrGui, Object userObj, int x,
            int y) {
        this.instrGUI = instrGui;
        this.userObj = userObj;

        if (userObj instanceof InstrumentCategory) {
            addCategoryMenuItem.setVisible(true);

            if (((InstrumentCategory) userObj).isRoot()) {
                removeCategoryMenuItem.setVisible(false);
            } else {
                removeCategoryMenuItem.setVisible(true);
            }

            addInstrumentMenu.setVisible(true);
            removeInstrumentMenuItem.setVisible(false);

            sep.setVisible(true);

            importItem.setEnabled(true);
            exportItem.setEnabled(false);

        } else {
            addCategoryMenuItem.setVisible(false);
            removeCategoryMenuItem.setVisible(false);
            addInstrumentMenu.setVisible(false);
            removeInstrumentMenuItem.setVisible(true);

            sep.setVisible(false);

            importItem.setEnabled(false);
            exportItem.setEnabled(true);

        }

        setBufferMenuItems();

        super.show(instrGui, x, y);
    }

    private void setBufferMenuItems() {
        pasteMenuItem.setEnabled(bufferedObj != null);

        if (userObj instanceof InstrumentCategory && ((InstrumentCategory) userObj).isRoot()) {

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

    private JMenu getAddInstrumentMenu() {
        JMenu instrumentMenu = new JMenu("Add Instrument");

        FileObject instrFiles[] = FileUtil.getConfigFile("blue/instruments").getChildren();
        List<FileObject> orderedInstrFiles
                = FileUtil.getOrder(Arrays.asList(instrFiles), true);

        JMenuItem temp;

        this.setLabel("Add Instrument");

        ActionListener al = new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Instrument instrTemplate = FileUtil.getConfigObject(e.getActionCommand(),
                        Instrument.class);
                try {
                    Instrument newInstrument = instrTemplate.getClass().newInstance();
                    addInstrument(newInstrument);
                } catch (InstantiationException | IllegalAccessException ex) {
                    Exceptions.printStackTrace(ex);
                }
            }
        };

        for (FileObject fObj : orderedInstrFiles) {
            String name = (String) fObj.getAttribute("displayName");
            System.out.println("NoteProcessor Name: " + name);
            temp = new JMenuItem();
            temp.setText(name);
            temp.setActionCommand(fObj.getPath());
            temp.addActionListener(al);
            instrumentMenu.add(temp);
        }

        return instrumentMenu;
    }
}
