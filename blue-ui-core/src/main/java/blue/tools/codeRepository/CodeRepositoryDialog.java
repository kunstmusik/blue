package blue.tools.codeRepository;

import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import blue.ui.utilities.UiUtilities;
import electric.xml.Element;
import electric.xml.ParseException;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.Frame;
import java.awt.dnd.DnDConstants;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTree;
import javax.swing.event.DocumentEvent;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreeNode;
import javax.swing.tree.TreePath;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

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
 * @author steven yi
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

    MimeTypeEditorComponent code1Text = new MimeTypeEditorComponent("text/plain");

    UndoManager undo = new UndoRedo.Manager();
    
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

        okButton.addActionListener((ActionEvent e) -> {
            DefaultMutableTreeNode node = (DefaultMutableTreeNode) codeTree
                    .getModel().getRoot();
            CodeRepositoryManager.saveCodeRepository(node);
            setVisible(false);
        });
        cancelButton.addActionListener((ActionEvent e) -> {
            setVisible(false);
        });

        this.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        this.getContentPane().add(temp, BorderLayout.SOUTH);
        this.setSize(600, 400);
        blue.utility.GUI.centerOnScreen(this);

        textPanel.setLayout(new BorderLayout());

        textPanel.add(code1Text, BorderLayout.CENTER);

        editPanel.setLayout(cards);
        editPanel.add(new JPanel(), "disabled");
        editPanel.add(textPanel, "enabled");

        cards.show(editPanel, "disabled");

        code1Text.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                if (selected != null && !selected.isGroup) {
                    selected.text = code1Text.getText();
                }
            }
        });
        
        code1Text.setUndoManager(undo);
        code1Text.getDocument().addUndoableEditListener(undo);

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

            codeTree.addMouseListener(new MouseAdapter() {

                @Override
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

                    if (UiUtilities.isRightMouseButton(e)) {
                        showPopup(tempNode, tempElem, e.getX(), e.getY());
                    } else {
                        if (tempElem.isGroup) {
                            cards.show(editPanel, "disabled");
                            selected = null;
                        } else {
                            cards.show(editPanel, "enabled");
                            selected = tempElem;
                            code1Text.setText(tempElem.text);
                        }
                        undo.discardAllEdits();;
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

    @Override
    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);

        Element elem = settings.getElement("splitVal");

        if (elem != null) {
            topSplit.setDividerLocation(Integer.parseInt(elem.getTextString()));
        }
    }

    @Override
    public Element saveWindowSettings() {
        Element retVal = WindowSettingManager.getBasicSettings(this);

        retVal.addElement("splitVal").setText(
                Integer.toString(topSplit.getDividerLocation()));

        return retVal;
    }
}
