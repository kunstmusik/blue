package blue.tools.blueShare.soundObjects;

import blue.BlueSystem;
import blue.library.LibraryItem;
import blue.soundObject.ObjectBuilder;
import blue.soundObject.Sound;
import blue.soundObject.SoundObject;
import blue.tools.blueShare.BlueShareRemoteCaller;
import blue.tools.blueShare.LibraryTreeModel;
import blue.tools.blueShare.NamePasswordPanel;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.IOException;
import java.util.HashMap;
import javafx.scene.control.TreeItem;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTextArea;
import javax.swing.JTree;
import javax.swing.border.TitledBorder;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreePath;
import org.apache.xmlrpc.XmlRpcException;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 *
 * @author unascribed
 * @version 1.0
 */
public class SoundObjectExportPane extends JComponent {

    private static final String SELECT_INSTR_TEXT = "Select a SoundObject to export";

    NamePasswordPanel namePasswordPanel = new NamePasswordPanel();

    JPanel jPanel2 = new JPanel();

    JSplitPane topSplitPane = new JSplitPane();

    JScrollPane descriptionScrollPane = new JScrollPane();

    JTextArea descriptionText = new JTextArea();

    JButton submitButton = new JButton();

    JPanel soundObjectListPanel = new JPanel();

    JTree soundObjectLibraryTree = new JTree();

    JScrollPane soundObjectListScrollPane = new JScrollPane();

    JLabel iLabel = new JLabel();

    JSplitPane mainSplitPane = new JSplitPane();

    JPanel categoryPanel = new JPanel();

    JLabel cateogriesLabel = new JLabel();

    JScrollPane categoryScrollPane = new JScrollPane();

    JTree categoryTree = new JTree();

    public SoundObjectExportPane() {

        soundObjectLibraryTree.setModel(
                new LibraryTreeModel(BlueSystem.getSoundObjectLibrary()));

        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }

        descriptionText.setText(SELECT_INSTR_TEXT);
        descriptionText.setEnabled(false);

    }

    private void jbInit() throws Exception {

        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        soundObjectListPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5,
                5));
        categoryPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        cateogriesLabel.setText(BlueSystem.getString("common.categories"));

        categoryPanel.setLayout(new BorderLayout());

        this.add(namePasswordPanel, BorderLayout.NORTH);
        this.add(mainSplitPane, BorderLayout.CENTER);
        this.add(jPanel2, BorderLayout.SOUTH);

        descriptionText.setText(BlueSystem
                .getString("blueShare.enterDescription"));
        descriptionText.setLineWrap(true);
        descriptionScrollPane.setBorder(new TitledBorder(null, BlueSystem
                .getString("blueShare.instrDescription")));

        submitButton.setText(BlueSystem.getString("common.submit"));

        soundObjectListPanel.setLayout(new BorderLayout());
        iLabel.setText("SoundObjects from Library");

        // soundObjectLibraryTree.setSelectionModel(TreeSelectionModel.SINGLE_TREE_SELECTION);
        topSplitPane.add(soundObjectListPanel, JSplitPane.LEFT);
        soundObjectListPanel.add(soundObjectListScrollPane, BorderLayout.CENTER);
        soundObjectListPanel.add(iLabel, BorderLayout.NORTH);
        soundObjectListScrollPane.getViewport().add(soundObjectLibraryTree, null);
        descriptionScrollPane.getViewport().add(descriptionText, null);
        jPanel2.add(submitButton, null);
        topSplitPane.setDividerLocation(300);

        mainSplitPane.setOrientation(JSplitPane.VERTICAL_SPLIT);
        mainSplitPane.add(topSplitPane, JSplitPane.TOP);
        mainSplitPane.add(descriptionScrollPane, JSplitPane.BOTTOM);

        topSplitPane.add(categoryPanel, JSplitPane.RIGHT);

        categoryPanel.add(cateogriesLabel, BorderLayout.NORTH);
        categoryPanel.add(categoryScrollPane, BorderLayout.CENTER);
        categoryScrollPane.getViewport().add(categoryTree, null);

        mainSplitPane.setDividerLocation(200);

        submitButton.addActionListener((ActionEvent e) -> {
            submitSoundObject();
        });

        soundObjectLibraryTree.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {

                TreePath path = soundObjectLibraryTree.getSelectionPath();
                if (path == null) {
                    descriptionText.setText(SELECT_INSTR_TEXT);
                    descriptionText.setEnabled(false);
                    return;
                }

                Object userObj = path.getLastPathComponent();
                TreeItem<LibraryItem<SoundObject>> node = 
                    (TreeItem<LibraryItem<SoundObject>>) userObj;

                if (!node.isLeaf()) {
                    descriptionText.setText(SELECT_INSTR_TEXT);
                    descriptionText.setEnabled(false);
                    return;
                }

                SoundObject instr = node.getValue().getValue();

                if (instr instanceof Sound) {
                    descriptionText.setText(((Sound) instr).getComment());
                } else if (instr instanceof ObjectBuilder) {
                    descriptionText.setText(((ObjectBuilder) instr).getComment());
                } else {
                    descriptionText.setText("");
                }

                descriptionText.setEnabled(true);
            }

        });
    }

    public void setCategories(BlueShareSoundObjectCategory[] categories) {
        DefaultMutableTreeNode root = new DefaultMutableTreeNode(BlueSystem
                .getString("common.categories"));
        addSubCategories(root, categories);

        categoryTree.setModel(new DefaultTreeModel(root));
    }

    private void addSubCategories(DefaultMutableTreeNode parent,
            BlueShareSoundObjectCategory[] categories) {
        DefaultMutableTreeNode temp;

        for (int i = 0; i < categories.length; i++) {
            temp = new DefaultMutableTreeNode(categories[i]);
            parent.add(temp);
            addSubCategories(temp, categories[i].getSubCategories());
        }
    }

    private void submitSoundObject() {
        try {
            TreePath path = soundObjectLibraryTree.getSelectionPath();
            if (path == null) {
                return;
            }

            Object userObj = path.getLastPathComponent();

            TreeItem<LibraryItem<SoundObject>> node = 
                    (TreeItem<LibraryItem<SoundObject>>) userObj;

            if (!node.isLeaf()) {
                return;
            }

            SoundObject soundObject = node.getValue().getValue();

            DefaultMutableTreeNode tempNode = (DefaultMutableTreeNode) categoryTree
                    .getSelectionPath().getLastPathComponent();
            BlueShareSoundObjectCategory category = (BlueShareSoundObjectCategory) tempNode
                    .getUserObject();

            String username = namePasswordPanel.getUsername();
            String password = namePasswordPanel.getPassword();

            int categoryId = category.getCategoryId();
            String name = soundObject.getName();
            String soundObjectType = soundObject.getClass().getName();
            String description = descriptionText.getText();

            String soundObjectText = soundObject.saveAsXML(new HashMap<>()).toString();

            System.out.println(soundObject.saveAsXML(new HashMap<>()).getTextString());

            BlueShareRemoteCaller.submitSoundObject(username, password,
                    categoryId, name, soundObjectType, description,
                    soundObjectText);
        } catch (IOException | XmlRpcException e) {
            JOptionPane.showMessageDialog(null, "Error submitting SoundObject"
                    + "\n\n" + e.getLocalizedMessage(), BlueSystem
                    .getString("common.error"), JOptionPane.ERROR_MESSAGE);
            e.printStackTrace();
            return;
        }
        JOptionPane.showMessageDialog(null, "SoundObject was successfully received.", BlueSystem
                .getString("common.success"), JOptionPane.PLAIN_MESSAGE);
    }

    public static void main(String[] args) {
        SoundObjectExportPane soundObjectExportPane1 = new SoundObjectExportPane();
        blue.utility.GUI.showComponentAsStandalone(soundObjectExportPane1,
                "SoundObject Export Pane Test", true);
    }

}
