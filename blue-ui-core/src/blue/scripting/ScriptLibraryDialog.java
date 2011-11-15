/*
 * ScriptManagerDialog.java
 *
 * Created on February 7, 2007, 7:54 PM
 */

package blue.scripting;

import java.awt.Component;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.filechooser.FileFilter;
import javax.swing.tree.DefaultTreeSelectionModel;
import javax.swing.tree.TreePath;
import javax.swing.tree.TreeSelectionModel;
import javax.swing.undo.UndoManager;

import org.python.core.PyException;

import skt.swing.SwingUtil;
import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.actions.RedoAction;
import blue.actions.UndoAction;
import blue.event.SimpleDocumentListener;
import blue.settings.GeneralSettings;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import blue.undo.NoStyleChangeUndoManager;
import blue.utility.GUI;
import blue.utility.GenericFileFilter;
import blue.utility.ObjectUtilities;
import electric.xml.Document;
import electric.xml.Element;

/**
 * 
 * @author steven
 */
public class ScriptLibraryDialog extends javax.swing.JDialog implements
        WindowSettingsSavable {

    private static final String IMPORT_DIALOG = "script.import";

    private static final String EXPORT_DIALOG = "script.export";

    Object bufferedObject = null;

    ScriptGroupPopup groupPopup = new ScriptGroupPopup();

    ScriptPopup scriptPopup = new ScriptPopup();

    Script script = null;

    UndoManager undo = new NoStyleChangeUndoManager();

    /** Creates new form ScriptManagerDialog */
    public ScriptLibraryDialog(java.awt.Frame parent, boolean modal) {
        super(parent, modal);
        initComponents();

        ScriptLibrary library = ScriptLibrary.getInstance();
        libraryTree.setModel(library);

        library.addTreeModelListener(new TreeModelListener() {

            public void treeNodesChanged(TreeModelEvent e) {
                // TODO Auto-generated method stub

            }

            public void treeNodesInserted(TreeModelEvent e) {
                // TODO Auto-generated method stub

            }

            public void treeNodesRemoved(TreeModelEvent e) {
                editScript(null);
            }

            public void treeStructureChanged(TreeModelEvent e) {
                // TODO Auto-generated method stub

            }

        });

        TreeSelectionModel selectionModel = new DefaultTreeSelectionModel();
        selectionModel
                .setSelectionMode(TreeSelectionModel.SINGLE_TREE_SELECTION);
        libraryTree.setSelectionModel(selectionModel);
        libraryTree.setEditable(true);

        libraryTree.addMouseListener(new MouseAdapter() {

            public void mousePressed(MouseEvent e) {

                if (UiUtilities.isRightMouseButton(e)
                        && libraryTree.getSelectionPath() != null) {
                    TreePath path = libraryTree.getSelectionPath();

                    Object selectedItem = path.getLastPathComponent();

                    if (selectedItem instanceof ScriptCategory) {
                        groupPopup.show((Component) e.getSource(), e.getX(), e
                                .getY());
                    } else if (selectedItem instanceof Script) {
                        scriptPopup.show((Component) e.getSource(), e.getX(), e
                                .getY());
                    }
                }
            }

            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isLeftMouseButton(e)) {
                    Script script = getSelectedScript();

                    editScript(script);

                }
            }

        });

        descriptionText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (script != null) {
                            script.setDescription(descriptionText.getText());
                        }
                    }
                });

        codePane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (script != null) {
                            script.setCode(codePane.getText());
                        }
                    }
                });

        codePane.setSyntaxType("Python");

        Action testAction = new AbstractAction("test-code") {
            public void actionPerformed(ActionEvent ae) {
                testButtonActionPerformed(ae);
            }
        };

        codePane.getDocument().addUndoableEditListener(undo);

        undo.setLimit(1000);

        testAction.putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                KeyEvent.VK_T, BlueSystem.getMenuShortcutKey()));

        SwingUtil.installActions(codePane, new Action[] { testAction,
                new UndoAction(undo), new RedoAction(undo) });

        commentsText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (script != null) {
                            script.setComments(commentsText.getText());
                        }
                    }
                });

        commentsText.setWrapStyleWord(true);
        commentsText.setLineWrap(true);
        commentsText.setTabSize(4);

        GUI.centerOnScreen(this);
        this.setSize(800, 600);

        editScript(null);

        WindowSettingManager.getInstance().registerWindow(
                "ScriptLibraryDialog", this);

        /* setup drag and drop */

        new ScriptTreeDragSource(libraryTree, DnDConstants.ACTION_COPY_OR_MOVE);
        new ScriptTreeDropTarget(libraryTree);

        /* setup file choosers */

        File defaultFile = new File(GeneralSettings.getInstance()
                .getDefaultDirectory()
                + File.separator + "default.script");

        FileFilter scriptFilter = new GenericFileFilter("script",
                "Program Script File");

        FileChooserManager.getDefault().addFilter(IMPORT_DIALOG, scriptFilter);
        FileChooserManager.getDefault().setDialogTitle(IMPORT_DIALOG, "Import Script");
        FileChooserManager.getDefault().setSelectedFile(IMPORT_DIALOG, defaultFile);

        FileChooserManager.getDefault().addFilter(EXPORT_DIALOG, scriptFilter);
        FileChooserManager.getDefault().setDialogTitle(EXPORT_DIALOG, "Export Script");
        FileChooserManager.getDefault().setSelectedFile(EXPORT_DIALOG, defaultFile);
    }

    private ScriptCategory getSelectedCategory() {
        TreePath path = libraryTree.getSelectionPath();

        if (path == null) {
            return null;
        }

        Object obj = path.getLastPathComponent();

        if (!(obj instanceof ScriptCategory)) {
            return null;
        }

        return (ScriptCategory) obj;
    }

    private Script getSelectedScript() {
        TreePath path = libraryTree.getSelectionPath();

        if (path == null) {
            return null;
        }

        Object obj = path.getLastPathComponent();

        if (!(obj instanceof Script)) {
            return null;
        }

        return (Script) obj;
    }

    public void editScript(Script script) {
        this.script = null;

        if (script == null) {
            descriptionText.setText("");
            codePane.setText("");
            commentsText.setText("");

            descriptionText.setEnabled(false);
            codePane.setEnabled(false);
            commentsText.setEnabled(false);
            testButton.setEnabled(false);

            undo.discardAllEdits();

            return;
        }

        descriptionText.setText(script.getDescription());
        codePane.setText(script.getCode());
        commentsText.setText(script.getComments());

        descriptionText.setEnabled(true);
        codePane.setEnabled(true);
        commentsText.setEnabled(true);
        testButton.setEnabled(true);

        this.script = script;
        undo.discardAllEdits();
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jSplitPane1 = new javax.swing.JSplitPane();
        jScrollPane1 = new javax.swing.JScrollPane();
        libraryTree = new javax.swing.JTree();
        scriptEditorPanel = new javax.swing.JPanel();
        descriptionLabel = new javax.swing.JLabel();
        descriptionText = new javax.swing.JTextField();
        jTabbedPane1 = new javax.swing.JTabbedPane();
        codePane = new blue.gui.BlueEditorPane();
        jScrollPane2 = new javax.swing.JScrollPane();
        commentsText = new javax.swing.JTextArea();
        testButton = new javax.swing.JButton();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        setTitle("Script Library");
        addWindowListener(new java.awt.event.WindowAdapter() {
            public void windowClosing(java.awt.event.WindowEvent evt) {
                formWindowClosing(evt);
            }
        });

        jSplitPane1.setDividerLocation(200);

        jScrollPane1.setViewportView(libraryTree);

        jSplitPane1.setLeftComponent(jScrollPane1);

        descriptionLabel.setText("Description");

        descriptionText.setToolTipText("Used as ToolTip for Script Menu Item");

        jTabbedPane1.addTab("Code", codePane);

        commentsText.setColumns(20);
        commentsText.setRows(5);
        jScrollPane2.setViewportView(commentsText);

        jTabbedPane1.addTab("Comments", jScrollPane2);

        testButton.setText("Test");
        testButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                testButtonActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout scriptEditorPanelLayout = new javax.swing.GroupLayout(scriptEditorPanel);
        scriptEditorPanel.setLayout(scriptEditorPanelLayout);
        scriptEditorPanelLayout.setHorizontalGroup(
            scriptEditorPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, scriptEditorPanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(scriptEditorPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                    .addComponent(jTabbedPane1, javax.swing.GroupLayout.Alignment.LEADING, javax.swing.GroupLayout.DEFAULT_SIZE, 365, Short.MAX_VALUE)
                    .addComponent(testButton)
                    .addGroup(scriptEditorPanelLayout.createSequentialGroup()
                        .addComponent(descriptionLabel)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(descriptionText, javax.swing.GroupLayout.DEFAULT_SIZE, 282, Short.MAX_VALUE)))
                .addContainerGap())
        );
        scriptEditorPanelLayout.setVerticalGroup(
            scriptEditorPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(scriptEditorPanelLayout.createSequentialGroup()
                .addContainerGap()
                .addGroup(scriptEditorPanelLayout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(descriptionLabel)
                    .addComponent(descriptionText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jTabbedPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 334, Short.MAX_VALUE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(testButton)
                .addContainerGap())
        );

        jSplitPane1.setRightComponent(scriptEditorPanel);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jSplitPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 616, Short.MAX_VALUE)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jSplitPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 435, Short.MAX_VALUE)
                .addContainerGap())
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void formWindowClosing(java.awt.event.WindowEvent evt) {// GEN-FIRST:event_formWindowClosing
        ScriptLibrary.getInstance().save();
    }// GEN-LAST:event_formWindowClosing

    private void testButtonActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_testButtonActionPerformed
        if (script == null) {
            return;
        }

        try {
            PythonProxy.processScript(script.getCode());
        } catch (PyException pyEx) {
            String msg = "Jython Error:\n" + pyEx.toString();
            JOptionPane.showMessageDialog(this, msg, BlueSystem
                    .getString("common.error"), JOptionPane.ERROR_MESSAGE);
        }
    }// GEN-LAST:event_testButtonActionPerformed

    /**
     * @param args
     *            the command line arguments
     */
    public static void main(String args[]) {
        java.awt.EventQueue.invokeLater(new Runnable() {
            public void run() {
                new ScriptLibraryDialog(new javax.swing.JFrame(), true)
                        .setVisible(true);
            }
        });
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private blue.gui.BlueEditorPane codePane;
    private javax.swing.JTextArea commentsText;
    private javax.swing.JLabel descriptionLabel;
    private javax.swing.JTextField descriptionText;
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JScrollPane jScrollPane2;
    private javax.swing.JSplitPane jSplitPane1;
    private javax.swing.JTabbedPane jTabbedPane1;
    private javax.swing.JTree libraryTree;
    private javax.swing.JPanel scriptEditorPanel;
    private javax.swing.JButton testButton;
    // End of variables declaration//GEN-END:variables

    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }

    private class ScriptGroupPopup extends JPopupMenu {

        public ScriptGroupPopup() {
            Action addGroup = new AbstractAction(BlueSystem
                    .getString("codeRepository.addGroup")) {

                public void actionPerformed(ActionEvent e) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    ScriptLibrary.getInstance().addCategory(cat,
                            new ScriptCategory());
                }

            };

            final Action removeGroup = new AbstractAction(BlueSystem
                    .getString("codeRepository.removeGroup")) {

                public void actionPerformed(ActionEvent e) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    ScriptLibrary.getInstance().removeScriptCategory(cat);
                }

            };

            Action addScript = new AbstractAction("Add Script") {

                public void actionPerformed(ActionEvent e) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    ScriptLibrary.getInstance().addScript(cat, new Script());
                }
            };

            Action cutAction = new AbstractAction(BlueSystem
                    .getString("common.cut")) {
                public void actionPerformed(ActionEvent ae) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(cat);

                    ScriptLibrary.getInstance().removeScriptCategory(cat);
                }
            };

            Action copyAction = new AbstractAction(BlueSystem
                    .getString("common.copy")) {
                public void actionPerformed(ActionEvent ae) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(cat);

                    ScriptLibrary.getInstance().removeScriptCategory(cat);
                }
            };

            final Action pasteAction = new AbstractAction(BlueSystem
                    .getString("common.paste")) {
                public void actionPerformed(ActionEvent ae) {

                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    if (bufferedObject != null) {

                        Object clone = ObjectUtilities.clone(bufferedObject);

                        if (clone instanceof ScriptCategory) {
                            ScriptCategory category = (ScriptCategory) clone;

                            ScriptLibrary.getInstance().addCategory(cat,
                                    category);

                        } else if (clone instanceof Script) {
                            Script effect = (Script) clone;

                            ScriptLibrary.getInstance().addScript(cat, effect);

                        }
                    }
                }
            };

            Action importItem = new AbstractAction(BlueSystem
                    .getString("common.import")) {

                public void actionPerformed(ActionEvent e) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    int retVal = FileChooserManager.getDefault().showOpenDialog(
                            IMPORT_DIALOG, ScriptLibraryDialog.this);

                    if (retVal == JFileChooser.APPROVE_OPTION) {

                        File f = FileChooserManager.getDefault()
                                .getSelectedFile(IMPORT_DIALOG);
                        Document doc;

                        try {
                            doc = new Document(f);
                            Element root = doc.getRoot();
                            if (root.getName().equals("scriptCategory")) {
                                ScriptCategory tempCat = ScriptCategory
                                        .loadFromXML(root);
                                ScriptLibrary.getInstance().addCategory(cat,
                                        tempCat);
                            } else if (root.getName().equals("script")) {
                                Script script = Script.loadFromXML(root);
                                ScriptLibrary.getInstance().addScript(cat,
                                        script);
                            } else {
                                JOptionPane.showMessageDialog(
                                        ScriptLibraryDialog.this,
                                        "Error: File did not contain scripts",
                                        "Error", JOptionPane.ERROR_MESSAGE);
                            }

                        } catch (Exception ex) {
                            ex.printStackTrace();
                            JOptionPane.showMessageDialog(
                                    ScriptLibraryDialog.this,
                                    "Error: Could not read scripts from file",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                        }

                    }

                }

            };

            Action exportItem = new AbstractAction(BlueSystem
                    .getString("common.export")) {

                public void actionPerformed(ActionEvent e) {
                    ScriptCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    int retVal = FileChooserManager.getDefault().showSaveDialog(
                            EXPORT_DIALOG, ScriptLibraryDialog.this);

                    if (retVal == JFileChooser.APPROVE_OPTION) {

                        File f = FileChooserManager.getDefault()
                                .getSelectedFile(EXPORT_DIALOG);

                        if (f.exists()) {
                            int overWrite = JOptionPane
                                    .showConfirmDialog(
                                            ScriptLibraryDialog.this,
                                            "Please confirm you would like to overwrite this file.");

                            if (overWrite != JOptionPane.OK_OPTION) {
                                return;
                            }
                        }

                        Element node = cat.saveAsXML();

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

            this.add(addGroup);
            this.add(removeGroup);
            this.addSeparator();
            this.add(addScript);
            this.addSeparator();
            this.add(cutAction);
            this.add(copyAction);
            this.add(pasteAction);
            this.addSeparator();
            this.add(importItem);
            this.add(exportItem);

            this.addPopupMenuListener(new PopupMenuListener() {

                public void popupMenuCanceled(PopupMenuEvent e) {
                }

                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    TreePath path = libraryTree.getSelectionPath();
                    removeGroup.setEnabled(path.getPathCount() != 1);

                    pasteAction.setEnabled(bufferedObject != null);
                }
            });
        }

    }

    private class ScriptPopup extends JPopupMenu {

        public ScriptPopup() {

            Action removeScript = new AbstractAction("Remove Script") {

                public void actionPerformed(ActionEvent e) {
                    Script script = getSelectedScript();
                    if (script == null) {
                        return;
                    }

                    ScriptLibrary.getInstance().removeScript(script);
                }
            };

            Action cutAction = new AbstractAction(BlueSystem
                    .getString("common.cut")) {
                public void actionPerformed(ActionEvent ae) {
                    Script effect = getSelectedScript();
                    if (effect == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(effect);

                    ScriptLibrary.getInstance().removeScript(script);
                }
            };

            Action copyAction = new AbstractAction(BlueSystem
                    .getString("common.copy")) {
                public void actionPerformed(ActionEvent ae) {
                    Script script = getSelectedScript();
                    if (script == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(script);
                }
            };

            Action exportItem = new AbstractAction(BlueSystem
                    .getString("common.export")) {

                public void actionPerformed(ActionEvent e) {
                    Script script = getSelectedScript();
                    if (script == null) {
                        return;
                    }

                    int retVal = FileChooserManager.getDefault().showSaveDialog(
                            EXPORT_DIALOG, ScriptLibraryDialog.this);

                    if (retVal == JFileChooser.APPROVE_OPTION) {

                        File f = FileChooserManager.getDefault()
                                .getSelectedFile(EXPORT_DIALOG);

                        if (f.exists()) {
                            int overWrite = JOptionPane
                                    .showConfirmDialog(
                                            ScriptLibraryDialog.this,
                                            "Please confirm you would like to overwrite this file.");

                            if (overWrite != JOptionPane.OK_OPTION) {
                                return;
                            }
                        }

                        Element node = script.saveAsXML();

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

            this.add(cutAction);
            this.add(copyAction);
            this.addSeparator();
            this.add(exportItem);
            this.addSeparator();
            this.add(removeScript);

        }

    }
}
