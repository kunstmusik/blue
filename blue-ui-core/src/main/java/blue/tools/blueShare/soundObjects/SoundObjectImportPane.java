package blue.tools.blueShare.soundObjects;

import blue.BlueSystem;
import blue.library.Library;
import blue.library.LibraryItem;
import blue.library.LibraryTreeItem;
import blue.soundObject.SoundObject;
import blue.tools.blueShare.BlueShareRemoteCaller;
import electric.xml.ParseException;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.IOException;
import javafx.scene.control.TreeItem;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.JTree;
import javax.swing.ListSelectionModel;
import javax.swing.SwingConstants;
import javax.swing.event.ListSelectionEvent;
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
// TODO - CLEAN UP THE GUI CODE IN THIS CLASS
public class SoundObjectImportPane extends JComponent {

    private final String AVAILABLE_INSTRUMENTS_LABEL = "Available SoundObjects";

    JSplitPane mainSplitPane = new JSplitPane();

    JPanel categoriesPanel = new JPanel();

    JSplitPane rightSplitPane = new JSplitPane();

    JPanel iListPanel = new JPanel();

    JLabel iOptionsLabel = new JLabel();

    JPanel instrumentInfoPanel = new JPanel();

    JPanel instrumentTopPanel = new JPanel();

    JLabel iNameLabel = new JLabel();

    JLabel submittedByLabel = new JLabel();

    JLabel iTypeLabel = new JLabel();

    JTextField iTypeText = new JTextField();

    JTextField iNameText = new JTextField();

    JTextField userText = new JTextField();

    JTextArea iDescription = new JTextArea();

    JPanel importButtonPanel = new JPanel();

    JButton importButton = new JButton();

    // JList categoriesList = new JList();
    JTree categoryTree = new JTree();

    JTable instrumentTable = new JTable();

    SoundObjectOptionTableModel iTableModel = new SoundObjectOptionTableModel();

    JPanel instrumentPanel = new JPanel();

    CardLayout cards = new CardLayout();

    JPanel instrCardPanel = new JPanel();

    CardLayout iListCard = new CardLayout();

    public SoundObjectImportPane() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(new BorderLayout());

        categoriesPanel.setLayout(new BorderLayout());
        JLabel categoriesLabel = new JLabel(BlueSystem
                .getString("common.categories"));

        rightSplitPane.setOrientation(JSplitPane.VERTICAL_SPLIT);

        iListPanel.setLayout(new BorderLayout());

        iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL);
        instrumentInfoPanel.setLayout(new BorderLayout());
        instrumentTopPanel.setLayout(new GridBagLayout());

        iNameLabel.setText(BlueSystem
                .getString("blueShare.instrumentNameLabel"));

        submittedByLabel.setText(BlueSystem
                .getString("blueShare.submittedByLabel"));
        iTypeLabel.setText(BlueSystem.getString("blueShare.instrumentType"));

        instrumentInfoPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5,
                5));
        iListPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        categoriesPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        importButton
                .setText("Import SoundObject");

        JScrollPane categoryScrollPane = new JScrollPane(categoryTree);

        this.add(mainSplitPane, BorderLayout.CENTER);
        mainSplitPane.add(categoriesPanel, JSplitPane.LEFT);
        categoriesPanel.add(categoryScrollPane, BorderLayout.CENTER);
        categoriesPanel.add(categoriesLabel, BorderLayout.NORTH);

        mainSplitPane.add(rightSplitPane, JSplitPane.RIGHT);
        rightSplitPane.add(iListPanel, JSplitPane.TOP);

        JLabel tempLabel = new JLabel("No SoundObjects for Category");
        tempLabel.setHorizontalAlignment(SwingConstants.CENTER);

        JScrollPane instrScrollPane = new JScrollPane(instrumentTable);

        instrCardPanel.setLayout(iListCard);
        instrCardPanel.add(instrScrollPane, "iList");
        instrCardPanel.add(tempLabel, "none");

        iListPanel.add(instrCardPanel, BorderLayout.CENTER);
        iListPanel.add(iOptionsLabel, BorderLayout.NORTH);

        instrumentPanel.setLayout(cards);
        instrumentPanel.add(instrumentInfoPanel, "instrumentInfo");

        tempLabel = new JLabel("Select SoundObject");
        tempLabel.setHorizontalAlignment(SwingConstants.CENTER);

        instrumentPanel.add(tempLabel, "blank");
        setSoundObjectEnabled(false);

        rightSplitPane.add(instrumentPanel, JSplitPane.BOTTOM);

        instrumentInfoPanel.add(instrumentTopPanel, BorderLayout.NORTH);
        instrumentTopPanel.add(iNameLabel, new GridBagConstraints(0, 0, 1, 1,
                0.0, 0.0, GridBagConstraints.EAST, GridBagConstraints.NONE,
                new Insets(0, 0, 3, 3), 0, 0));
        instrumentTopPanel.add(submittedByLabel, new GridBagConstraints(0, 2,
                1, 1, 0.0, 0.0, GridBagConstraints.EAST,
                GridBagConstraints.NONE, new Insets(0, 0, 3, 3), 0, 0));
        instrumentTopPanel.add(iTypeText, new GridBagConstraints(1, 1, 1, 1,
                1.0, 0.0, GridBagConstraints.WEST,
                GridBagConstraints.HORIZONTAL, new Insets(0, 0, 3, 1), 0, 0));
        instrumentTopPanel.add(userText, new GridBagConstraints(1, 2, 1, 1,
                1.0, 0.0, GridBagConstraints.WEST,
                GridBagConstraints.HORIZONTAL, new Insets(0, 0, 3, 1), 0, 0));

        JScrollPane descriptionScroll = new JScrollPane();

        instrumentInfoPanel.add(descriptionScroll, BorderLayout.CENTER);
        instrumentInfoPanel.add(importButtonPanel, BorderLayout.SOUTH);
        descriptionScroll.getViewport().add(iDescription, null);

        instrumentTopPanel.add(iNameText, new GridBagConstraints(1, 0, 1, 1,
                1.0, 0.0, GridBagConstraints.WEST,
                GridBagConstraints.HORIZONTAL, new Insets(0, 0, 3, 1), 0, 0));
        instrumentTopPanel.add(iTypeLabel, new GridBagConstraints(0, 1, 1, 1,
                0.0, 0.0, GridBagConstraints.EAST, GridBagConstraints.NONE,
                new Insets(0, 0, 3, 3), 0, 0));

        importButtonPanel.add(importButton, null);

        instrumentTable.setModel(iTableModel);

        iDescription.setLineWrap(true);

        mainSplitPane.setDividerLocation(200);
        rightSplitPane.setDividerLocation(200);

        instrumentTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        categoryTree.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                int row = categoryTree.getClosestRowForLocation(e.getX(), e
                        .getY());
                TreePath path = categoryTree.getClosestPathForLocation(
                        e.getX(), e.getY());

                if (row == -1) {
                    /*
                     * cards.show(editPanel, "disabled"); selected = null;
                     */
                    return;
                }

                try {
                    DefaultMutableTreeNode tempNode = (DefaultMutableTreeNode) path
                            .getLastPathComponent();
                    BlueShareSoundObjectCategory tempCat = (BlueShareSoundObjectCategory) tempNode
                            .getUserObject();

                    populateSoundObjects(tempCat);
                } catch (ClassCastException cce) {
                    // do nothing and ignore (top level root is just a string)
                }

            }
        });

        instrumentTable.getSelectionModel().addListSelectionListener((ListSelectionEvent e) -> {
            if (e.getValueIsAdjusting()) {
                return;
            }
            populateSoundObject();
        });

        importButton.addActionListener((ActionEvent e) -> {
            importSoundObject();
        });
    }

    private void populateSoundObjects(BlueShareSoundObjectCategory category) {
        iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                + BlueSystem.getString("blueShare.loading"));
        try {

            SoundObjectOption[] options;

            if (category.getCategoryId() == Integer.MIN_VALUE) {
                options = BlueShareRemoteCaller.getLatestTenSoundObjects();
            } else {
                options = BlueShareRemoteCaller.getSoundObjectOptions(category);
            }

            iTableModel.setSoundObjectOptions(options);
            setSoundObjectEnabled(false);
            if (options.length > 0) {
                iListCard.show(instrCardPanel, "iList");
            } else {
                iListCard.show(instrCardPanel, "none");
            }
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + category.getName());
        } catch (ParseException pe) {
            String error = BlueSystem
                    .getString("blueShare.selectServer.couldNotReadResponse");
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + BlueSystem.getString("message.error"));
            return;
        } catch (XmlRpcException xre) {
            String error = "Error: " + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + BlueSystem.getString("message.error"));
            return;
        } catch (IOException ioe) {
            String error = "Error: " + ioe.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + BlueSystem.getString("message.error"));
            return;
        }
    }

    private void populateSoundObject() {
        SoundObjectOption iOption = iTableModel
                .getSoundObjectOption(instrumentTable.getSelectedRow());
        if (iOption != null) {
            iNameText.setText(iOption.getName());
            iTypeText.setText(iOption.getType());
            userText.setText(iOption.getScreenName());
            iDescription.setText(iOption.getDescription());
        }
        setSoundObjectEnabled(true);
    }

    private void setSoundObjectEnabled(boolean val) {
        if (val) {
            cards.show(instrumentPanel, "instrumentInfo");
        } else {
            cards.show(instrumentPanel, "blank");
        }
    }

    private void importSoundObject() {
        SoundObjectOption iOption = iTableModel
                .getSoundObjectOption(instrumentTable.getSelectedRow());
        if (iOption == null) {
            return;
        }

        try {
            SoundObject soundObject = BlueShareRemoteCaller
                    .getSoundObject(iOption);

            if (soundObject == null) {
                String error = "Error: Could not import this SoundObject.";
                JOptionPane.showMessageDialog(null, error, BlueSystem
                        .getString("message.error"), JOptionPane.ERROR_MESSAGE);
                return;

            }

            // data.getOrchestra().addSoundObject(instrument);
            // instrumentTreeModel.reload();
            Library<SoundObject> instrLib = BlueSystem.getSoundObjectLibrary();

            importSoundObjectToLibrary(instrLib, soundObject);

            String message = BlueSystem.getString("blueShare.importSuccess");
            JOptionPane.showMessageDialog(null, message, BlueSystem
                    .getString("common.success"), JOptionPane.PLAIN_MESSAGE);

        } catch (ParseException pe) {
            String error = BlueSystem
                    .getString("blueShare.selectServer.couldNotReadResponse");
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        } catch (XmlRpcException xre) {
            String error = "Error: " + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        } catch (IOException ioe) {
            String error = "Error: " + ioe.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        }
    }

    protected void importSoundObjectToLibrary(Library<SoundObject> lib, SoundObject sObj) {
        for (TreeItem<LibraryItem<SoundObject>> item : lib.getRoot().getChildren()) {
            if (!item.isLeaf() && 
                    item.getValue().toString().equals("Imported SoundObjects")) {
                item.getChildren().add(new LibraryTreeItem(new LibraryItem<>(sObj)));
                return;
            }
        }

        LibraryTreeItem importFolder = new LibraryTreeItem(
                new LibraryItem<>("Imported SoundObjects"));
        importFolder.getChildren().add(new LibraryTreeItem(new LibraryItem<>(sObj)));
        lib.getRoot().getChildren().add(importFolder);
    }

    /**
     * Passes in the categories retrieved from the server using
     * BlueShareRemoteCaller
     */
    public void setCategories(BlueShareSoundObjectCategory[] categories) {
        DefaultMutableTreeNode root = new DefaultMutableTreeNode(BlueSystem
                .getString("common.categories"));

        BlueShareSoundObjectCategory latestSoundObjects = new BlueShareSoundObjectCategory(
                Integer.MIN_VALUE, ">Latest SoundObjects",
                "Newest SoundObjects in Repository", null);

        DefaultMutableTreeNode temp = new DefaultMutableTreeNode(
                latestSoundObjects);
        root.add(temp);

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

    public static void main(String[] args) {
        SoundObjectImportPane instrumentImportPane1 = new SoundObjectImportPane();
        blue.utility.GUI.showComponentAsStandalone(instrumentImportPane1,
                "SoundObject Import Pane Test", true);
    }
}
