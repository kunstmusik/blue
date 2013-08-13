/*
 * EffectLibraryDialog.java
 *
 * Created on February 28, 2006, 8:12 PM
 */

package blue.ui.core.mixer;

import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.mixer.*;
import blue.ui.core.mixer.EffectCategory;
import blue.ui.core.mixer.EffectsLibrary;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import java.awt.Component;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.tree.DefaultTreeSelectionModel;
import javax.swing.tree.TreePath;
import javax.swing.tree.TreeSelectionModel;

/**
 * 
 * @author steven
 */
public class EffectsLibraryDialog extends javax.swing.JDialog implements
        WindowSettingsSavable {

    Object bufferedObject = null;

    EffectGroupPopup groupPopup = new EffectGroupPopup();

    EffectPopup effectPopup = new EffectPopup();

    EffectEditor effectEditor = new EffectEditor();

    /** Creates new form EffectLibraryDialog */
    public EffectsLibraryDialog(java.awt.Frame parent, boolean modal) {
        super(parent, modal);
        initComponents();
        splitPane.setRightComponent(effectEditor);

        EffectsLibrary library = EffectsLibrary.getInstance();
        libraryTree.setModel(library);

        library.addTreeModelListener(new TreeModelListener() {

            @Override
            public void treeNodesChanged(TreeModelEvent e) {
                // TODO Auto-generated method stub

            }

            @Override
            public void treeNodesInserted(TreeModelEvent e) {
                // TODO Auto-generated method stub

            }

            @Override
            public void treeNodesRemoved(TreeModelEvent e) {
                effectEditor.setEffect(null);
            }

            @Override
            public void treeStructureChanged(TreeModelEvent e) {
                // TODO Auto-generated method stub

            }

        });

        TreeSelectionModel selectionModel = new DefaultTreeSelectionModel();
        selectionModel
                .setSelectionMode(TreeSelectionModel.SINGLE_TREE_SELECTION);
        libraryTree.setSelectionModel(selectionModel);
        libraryTree.setEditable(true);

        new EffectTreeDragSource(libraryTree, DnDConstants.ACTION_MOVE);
        new EffectTreeDropTarget(libraryTree);

        libraryTree.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {

                if (UiUtilities.isRightMouseButton(e)
                        && libraryTree.getSelectionPath() != null) {
                    TreePath path = libraryTree.getSelectionPath();

                    Object selectedItem = path.getLastPathComponent();

                    if (selectedItem instanceof EffectCategory) {
                        groupPopup.show((Component) e.getSource(), e.getX(), e
                                .getY());
                    } else if (selectedItem instanceof Effect) {
                        effectPopup.show((Component) e.getSource(), e.getX(), e
                                .getY());
                    }
                }
            }

            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isLeftMouseButton(e)) {
                    Effect effect = getSelectedEffect();

                    effectEditor.setEffect(effect);

                }
            }

        });

        GUI.centerOnScreen(this);
        this.setTitle("Effects Library");
        this.setSize(800, 600);

        WindowSettingManager.getInstance().registerWindow(
                "EffectsLibraryDialog", this);
    }

    private EffectCategory getSelectedCategory() {
        TreePath path = libraryTree.getSelectionPath();

        if (path == null) {
            return null;
        }

        Object obj = path.getLastPathComponent();

        if (!(obj instanceof EffectCategory)) {
            return null;
        }

        return (EffectCategory) obj;
    }

    private Effect getSelectedEffect() {
        TreePath path = libraryTree.getSelectionPath();

        if (path == null) {
            return null;
        }

        Object obj = path.getLastPathComponent();

        if (!(obj instanceof Effect)) {
            return null;
        }

        return (Effect) obj;
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        splitPane = new javax.swing.JSplitPane();
        treeScroll = new javax.swing.JScrollPane();
        libraryTree = new javax.swing.JTree();

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        addWindowListener(new java.awt.event.WindowAdapter() {
            public void windowClosing(java.awt.event.WindowEvent evt) {
                formWindowClosing(evt);
            }
        });

        splitPane.setDividerLocation(200);
        splitPane.setLastDividerLocation(200);

        treeScroll.setViewportView(libraryTree);

        splitPane.setLeftComponent(treeScroll);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(splitPane, javax.swing.GroupLayout.DEFAULT_SIZE, 593, Short.MAX_VALUE)
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(splitPane, javax.swing.GroupLayout.DEFAULT_SIZE, 414, Short.MAX_VALUE)
                .addContainerGap())
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void formWindowClosing(java.awt.event.WindowEvent evt) {// GEN-FIRST:event_formWindowClosing
        EffectsLibrary.getInstance().save();
    }// GEN-LAST:event_formWindowClosing

    /**
     * @param args
     *            the command line arguments
     */
    public static void main(String args[]) {
        GUI.setBlueLookAndFeel();

        EffectsLibraryDialog library = new EffectsLibraryDialog(null, true);
        library.addWindowListener(new WindowAdapter() {

            @Override
            public void windowClosed(WindowEvent e) {
                System.exit(0);
            }
        });
        library.setVisible(true);
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JTree libraryTree;
    private javax.swing.JSplitPane splitPane;
    private javax.swing.JScrollPane treeScroll;
    // End of variables declaration//GEN-END:variables

    @Override
    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    @Override
    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }

    private class EffectGroupPopup extends JPopupMenu {

        public EffectGroupPopup() {
            Action addGroup = new AbstractAction(BlueSystem
                    .getString("codeRepository.addGroup")) {

                @Override
                public void actionPerformed(ActionEvent e) {
                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    EffectsLibrary.getInstance().addCategory(cat,
                            new EffectCategory());
                }

            };

            final Action removeGroup = new AbstractAction(BlueSystem
                    .getString("codeRepository.removeGroup")) {

                @Override
                public void actionPerformed(ActionEvent e) {
                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    EffectsLibrary.getInstance().removeEffectCategory(cat);
                }

            };

            Action addEffect = new AbstractAction("Add Effect") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    EffectsLibrary.getInstance().addEffect(cat, new Effect());
                }
            };

            Action cutAction = new AbstractAction(BlueSystem
                    .getString("common.cut")) {
                @Override
                public void actionPerformed(ActionEvent ae) {
                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(cat);

                    EffectsLibrary.getInstance().removeEffectCategory(cat);
                }
            };

            Action copyAction = new AbstractAction(BlueSystem
                    .getString("common.copy")) {
                @Override
                public void actionPerformed(ActionEvent ae) {
                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(cat);

                    EffectsLibrary.getInstance().removeEffectCategory(cat);
                }
            };

            final Action pasteAction = new AbstractAction(BlueSystem
                    .getString("common.paste")) {
                @Override
                public void actionPerformed(ActionEvent ae) {

                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    if (bufferedObject != null) {

                        Object clone = ObjectUtilities.clone(bufferedObject);

                        if (clone instanceof EffectCategory) {
                            EffectCategory category = (EffectCategory) clone;

                            EffectsLibrary.getInstance().addCategory(cat,
                                    category);

                        } else if (clone instanceof Effect) {
                            Effect effect = (Effect) clone;

                            EffectsLibrary.getInstance().addEffect(cat, effect);

                        }
                    }
                }
            };

            Action importAction = new AbstractAction("Import from File") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    EffectCategory cat = getSelectedCategory();
                    if (cat == null) {
                        return;
                    }

                    Effect effect = EffectsUtil.importEffect();

                    if (effect != null) {
                        EffectsLibrary.getInstance().addEffect(cat, effect);
                    }
                }

            };

            this.add(addGroup);
            this.add(removeGroup);
            this.addSeparator();
            this.add(addEffect);
            this.addSeparator();
            this.add(cutAction);
            this.add(copyAction);
            this.add(pasteAction);
            this.addSeparator();
            this.add(importAction);

            this.addPopupMenuListener(new PopupMenuListener() {

                @Override
                public void popupMenuCanceled(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    TreePath path = libraryTree.getSelectionPath();
                    removeGroup.setEnabled(path.getPathCount() != 1);

                    pasteAction.setEnabled(bufferedObject != null);
                }
            });
        }

    }

    private class EffectPopup extends JPopupMenu {

        public EffectPopup() {

            Action removeEffect = new AbstractAction("Remove Effect") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    Effect effect = getSelectedEffect();
                    if (effect == null) {
                        return;
                    }

                    EffectsLibrary.getInstance().removeEffect(effect);
                }
            };

            Action cutAction = new AbstractAction(BlueSystem
                    .getString("common.cut")) {
                @Override
                public void actionPerformed(ActionEvent ae) {
                    Effect effect = getSelectedEffect();
                    if (effect == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(effect);

                    EffectsLibrary.getInstance().removeEffect(effect);
                }
            };

            Action copyAction = new AbstractAction(BlueSystem
                    .getString("common.copy")) {
                @Override
                public void actionPerformed(ActionEvent ae) {
                    Effect effect = getSelectedEffect();
                    if (effect == null) {
                        return;
                    }

                    bufferedObject = ObjectUtilities.clone(effect);
                }
            };

            Action exportAction = new AbstractAction("Export to File") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    Effect effect = getSelectedEffect();
                    if (effect == null) {
                        return;
                    }

                    EffectsUtil.exportEffect(effect);

                }

            };

            this.add(cutAction);
            this.add(copyAction);
            this.addSeparator();
            this.add(removeEffect);
            this.addSeparator();
            this.add(exportAction);
        }

    }

}
