package blue.tools.blueShare.effects;

import blue.BlueSystem;
import blue.mixer.Effect;
import blue.tools.blueShare.BlueShareRemoteCaller;
import blue.tools.blueShare.NamePasswordPanel;
import blue.ui.core.mixer.EffectsLibrary;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.IOException;
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

public class EffectExportPane extends JComponent {

    private static final String SELECT_EFFECT_TEXT = "Select an Effect to export";

    NamePasswordPanel namePasswordPanel = new NamePasswordPanel();

    JPanel jPanel2 = new JPanel();

    JSplitPane topSplitPane = new JSplitPane();

    JScrollPane descriptionScrollPane = new JScrollPane();

    JTextArea descriptionText = new JTextArea();

    JButton submitButton = new JButton();

    JPanel instrumentListPanel = new JPanel();

    JTree effectLibraryTree = new JTree();

    JScrollPane instrumentListScrollPane = new JScrollPane();

    JLabel iLabel = new JLabel();

    JSplitPane mainSplitPane = new JSplitPane();

    JPanel categoryPanel = new JPanel();

    JLabel cateogriesLabel = new JLabel();

    JScrollPane categoryScrollPane = new JScrollPane();

    JTree categoryTree = new JTree();

    public EffectExportPane() {

        effectLibraryTree.setModel(EffectsLibrary.getInstance());

        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }

        descriptionText.setText(SELECT_EFFECT_TEXT);
        descriptionText.setEnabled(false);
    }

    private void jbInit() throws Exception {

        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        instrumentListPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5,
                5));
        categoryPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        cateogriesLabel.setText(BlueSystem.getString("common.categories"));

        categoryPanel.setLayout(new BorderLayout());

        this.add(namePasswordPanel, BorderLayout.NORTH);
        this.add(mainSplitPane, BorderLayout.CENTER);
        this.add(jPanel2, BorderLayout.SOUTH);

        descriptionText.setText(BlueSystem
                .getString("blueShare.effect.enterDescription"));
        descriptionText.setLineWrap(true);
        descriptionScrollPane.setBorder(new TitledBorder(null, BlueSystem
                .getString("blueShare.effect.effectDescription")));

        submitButton.setText(BlueSystem.getString("common.submit"));

        instrumentListPanel.setLayout(new BorderLayout());
        iLabel.setText(BlueSystem
                .getString("blueShare.effect.effectsFromEffectsLibrary"));

        // instrumentLibraryTree.setSelectionModel(TreeSelectionModel.SINGLE_TREE_SELECTION);

        topSplitPane.add(instrumentListPanel, JSplitPane.LEFT);
        instrumentListPanel.add(instrumentListScrollPane, BorderLayout.CENTER);
        instrumentListPanel.add(iLabel, BorderLayout.NORTH);
        instrumentListScrollPane.getViewport().add(effectLibraryTree, null);
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

        submitButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                submitEffect();
            }
        });

        effectLibraryTree.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {

                TreePath path = effectLibraryTree.getSelectionPath();
                if (path == null) {
                    descriptionText.setText(SELECT_EFFECT_TEXT);
                    descriptionText.setEnabled(false);
                    return;
                }

                Object userObj = path.getLastPathComponent();

                if (!(userObj instanceof Effect)) {
                    descriptionText.setText(SELECT_EFFECT_TEXT);
                    descriptionText.setEnabled(false);
                    return;
                }

                Effect effect = (Effect) userObj;

                descriptionText.setText(effect.getComments());
                descriptionText.setEnabled(true);
            }

        });
    }

    public void setCategories(BlueShareEffectCategory[] categories) {
        DefaultMutableTreeNode root = new DefaultMutableTreeNode(BlueSystem
                .getString("common.categories"));
        addSubCategories(root, categories);

        categoryTree.setModel(new DefaultTreeModel(root));
    }

    private void addSubCategories(DefaultMutableTreeNode parent,
            BlueShareEffectCategory[] categories) {
        DefaultMutableTreeNode temp;

        for (int i = 0; i < categories.length; i++) {
            temp = new DefaultMutableTreeNode(categories[i]);
            parent.add(temp);
            addSubCategories(temp, categories[i].getSubCategories());
        }
    }

    private void submitEffect() {
        try {
            TreePath path = effectLibraryTree.getSelectionPath();
            if (path == null) {
                return;
            }

            Object userObj = path.getLastPathComponent();

            if (!(userObj instanceof Effect)) {
                return;
            }

            Effect effect = (Effect) userObj;

            DefaultMutableTreeNode tempNode = (DefaultMutableTreeNode) categoryTree
                    .getSelectionPath().getLastPathComponent();
            BlueShareEffectCategory category = (BlueShareEffectCategory) tempNode
                    .getUserObject();

            String username = namePasswordPanel.getUsername();
            String password = namePasswordPanel.getPassword();

            int categoryId = category.getCategoryId();
            String name = effect.getName();
            String description = descriptionText.getText();

            String effectText = effect.saveAsXML().toString();

            System.out.println(effect.saveAsXML().getTextString());

            BlueShareRemoteCaller.submitEffect(username, password, categoryId,
                    name, description, effectText);
        } catch (IOException | XmlRpcException e) {
            JOptionPane.showMessageDialog(null, BlueSystem
                    .getString("blueShare.effect.errorSubmittingEffect")
                    + "\n\n" + e.getLocalizedMessage(), BlueSystem
                    .getString("common.error"), JOptionPane.ERROR_MESSAGE);
            e.printStackTrace();
            return;
        }
        JOptionPane.showMessageDialog(null, BlueSystem
                .getString("blueShare.effect.successfullyReceived"), BlueSystem
                .getString("common.success"), JOptionPane.PLAIN_MESSAGE);
    }

    public static void main(String[] args) {
        EffectExportPane instrumentExportPane1 = new EffectExportPane();
        blue.utility.GUI.showComponentAsStandalone(instrumentExportPane1,
                "Instrument Export Pane Test", true);
    }

}