package blue.tools.codeRepository;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTree;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreeNode;
import javax.swing.tree.TreePath;

import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.gui.BlueEditorPane;
import blue.gui.OpcodePopup;
import electric.xml.Element;
import electric.xml.ParseException;
import java.awt.Frame;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class CodeRepositoryDialog extends JDialog implements
        WindowSettingsSavable {

    private static final CodeRepositoryPopup popup = new CodeRepositoryPopup();

    JSplitPane topSplit = new JSplitPane();

    BorderLayout borderLayout1 = new BorderLayout();

    JTree codeTree;

    DefaultTreeModel treeModel;

    CardLayout cards = new CardLayout();

    ElementHolder selected;

    BlueEditorPane codeText = new BlueEditorPane();

    JPanel editPanel = new JPanel();

    JPanel textPanel = new JPanel();

    JButton okButton = new JButton(BlueSystem
            .getString("programOptions.okButton"));

    JButton cancelButton = new JButton(BlueSystem
            .getString("programOptions.cancelButton"));

    public CodeRepositoryDialog(Frame owner) {
        super(owner);
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setTitle(BlueSystem.getString("codeRepository.title"));
        setupTree();
        this.getContentPane().setLayout(borderLayout1);
        this.getContentPane().add(topSplit, BorderLayout.CENTER);

        JScrollPane jScrollPane1 = new JScrollPane();
        jScrollPane1.setBorder(null);

        topSplit.add(jScrollPane1, JSplitPane.LEFT);
        topSplit.add(editPanel, JSplitPane.RIGHT);
        jScrollPane1.getViewport().add(codeTree, null);
        topSplit.setDividerLocation(200);

        JPanel temp = new JPanel();
        temp.setLayout(new FlowLayout(FlowLayout.CENTER));
        temp.add(okButton);
        temp.add(cancelButton);

        okButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                DefaultMutableTreeNode node = (DefaultMutableTreeNode) codeTree
                        .getModel().getRoot();
                CodeRepositoryManager.saveCodeRepository(node);
                OpcodePopup.getOpcodePopup().reinitialize();
                setVisible(false);
            }
        });
        cancelButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                setVisible(false);
            }
        });

        this.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        this.getContentPane().add(temp, BorderLayout.SOUTH);
        this.setSize(600, 400);
        blue.utility.GUI.centerOnScreen(this);

        textPanel.setLayout(new BorderLayout());

        textPanel.add(codeText, BorderLayout.CENTER);

        editPanel.setLayout(cards);
        editPanel.add(new JPanel(), "disabled");
        editPanel.add(textPanel, "enabled");

        cards.show(editPanel, "disabled");

        codeText.getDocument().addDocumentListener(new DocumentListener() {

            public void insertUpdate(DocumentEvent e) {
                updateText();
            }

            public void removeUpdate(DocumentEvent e) {
                updateText();
            }

            public void changedUpdate(DocumentEvent e) {
                updateText();
            }

            public void updateText() {
                if (selected != null && !selected.isGroup) {
                    selected.text = codeText.getText();
                }
            }
        });

        new CodeRepositoryDragSource(codeTree, DnDConstants.ACTION_MOVE);
        new CodeRepositoryDropTarget(codeTree);

        WindowSettingManager.getInstance().registerWindow(
                "CodeRepositoryDialog", this);
    }

    private void setupTree() {
        try {

            TreeNode rootNode = CodeRepositoryManager
                    .getCodeRepositoryTreeNode(true);
            codeTree = new JTree(rootNode);

            treeModel = (DefaultTreeModel) codeTree.getModel();

            treeModel.setAsksAllowsChildren(true);

            codeTree.setEditable(true);

            /*
             * codeTree.getModel().addTreeModelListener(new TreeModelListener() {
             * public void treeNodesChanged(TreeModelEvent e) {
             * DefaultMutableTreeNode node; node = (DefaultMutableTreeNode)
             * (e.getTreePath().getLastPathComponent()); try { int index =
             * e.getChildIndices()[0]; DefaultMutableTreeNode newNode =
             * (DefaultMutableTreeNode) (node.getChildAt(index));
             * //ElementHolder elem = (ElementHolder)node.getUserObject(); }
             * catch (NullPointerException exc) {}
             * 
             * System.out.println("The user has finished editing the node.");
             * System.out.println("New value: " + node.getUserObject()); }
             * public void treeNodesInserted(TreeModelEvent e) { } public void
             * treeNodesRemoved(TreeModelEvent e) { } public void
             * treeNodesStructureChanged(TreeModelEvent e) { } public void
             * treeStructureChanged(TreeModelEvent e) { }
             * 
             * });
             */

            codeTree.addMouseListener(new MouseAdapter() {

                public void mouseClicked(MouseEvent e) {
                    int row = codeTree.getClosestRowForLocation(e.getX(), e
                            .getY());
                    TreePath path = codeTree.getClosestPathForLocation(
                            e.getX(), e.getY());

                    if (row == -1) {
                        cards.show(editPanel, "disabled");
                        selected = null;
                        return;
                    }

                    CodeRepositoryTreeNode tempNode = (CodeRepositoryTreeNode) path
                            .getLastPathComponent();
                    ElementHolder tempElem = (ElementHolder) tempNode
                            .getUserObject();

                    if (SwingUtilities.isRightMouseButton(e)) {
                        showPopup(tempNode, tempElem, e.getX(), e.getY());
                    } else {
                        if (tempElem.isGroup) {
                            cards.show(editPanel, "disabled");
                            selected = null;
                        } else {
                            cards.show(editPanel, "enabled");
                            selected = tempElem;
                            codeText.setText(tempElem.text);
                        }

                    }
                }
            });

        } catch (ParseException pe) {
            System.out
                    .println("[blue.gui.OpcodePopup] There was an error trying to open or parse opcodes.xml or codeRepository.xml");
            pe.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void showPopup(CodeRepositoryTreeNode node, ElementHolder elem,
            int x, int y) {
        popup.show(this, node, elem, x, y);
    }

//    // UNIT TEST
//    public static void main(String[] args) {
//        CodeRepositoryDialog codeRepositoryDialog1 = new CodeRepositoryDialog();
//        codeRepositoryDialog1.addWindowListener(new WindowAdapter() {
//
//            public void windowClosing(WindowEvent e) {
//                System.exit(0);
//            }
//        });
//        codeRepositoryDialog1.show();
//        codeRepositoryDialog1
//                .setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
//    }

    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);

        Element elem = settings.getElement("splitVal");

        if (elem != null) {
            topSplit.setDividerLocation(Integer.parseInt(elem.getTextString()));
        }
    }

    public Element saveWindowSettings() {
        Element retVal = WindowSettingManager.getBasicSettings(this);

        retVal.addElement("splitVal").setText(
                Integer.toString(topSplit.getDividerLocation()));

        return retVal;
    }
}

/*
 * class CodeRepositoryTreeModel extends DefaultTreeModel { public
 * CodeRepositoryTreeModel(TreeNode root) { super(root); //this. } }
 */

/*
 * class CodeRepositoryTreeCellRenderer extends DefaultTreeCellRenderer { public
 * Component getTreeCellRendererComponent(JTree tree, Object value, boolean sel,
 * boolean expanded, boolean leaf, int row, boolean hasFocus) {
 * 
 * CodeRepositoryTreeNode node = (CodeRepositoryTreeNode)value; ElementHolder
 * elem = (ElementHolder)node.getUserObject();
 * 
 * String stringValue = tree.convertValueToText(value, sel, expanded, leaf, row,
 * hasFocus);
 * 
 * this.hasFocus = hasFocus; setText(stringValue); if(sel)
 * setForeground(getTextSelectionColor()); else
 * setForeground(getTextNonSelectionColor()); // There needs to be a way to
 * specify disabled icons. if (!tree.isEnabled()) { setEnabled(false); if
 * (!elem.isGroup) { setDisabledIcon(getLeafIcon()); } else if (expanded) {
 * setDisabledIcon(getOpenIcon()); } else { setDisabledIcon(getClosedIcon()); } }
 * else { setEnabled(true); if (!elem.isGroup) { setIcon(getLeafIcon()); } else
 * if (expanded) { setIcon(getOpenIcon()); } else { setIcon(getClosedIcon()); } }
 * setComponentOrientation(tree.getComponentOrientation());
 * 
 * selected = sel;
 * 
 * return this; } }
 */