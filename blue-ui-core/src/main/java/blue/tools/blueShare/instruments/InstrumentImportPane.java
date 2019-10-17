package blue.tools.blueShare.instruments;

import blue.BlueSystem;
import blue.InstrumentLibrary;
import blue.orchestra.Instrument;
import blue.tools.blueShare.BlueShareRemoteCaller;
import electric.xml.ParseException;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
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
import javax.swing.JTable;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.JTree;
import javax.swing.ListSelectionModel;
import javax.swing.SwingConstants;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
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
public class InstrumentImportPane extends JComponent {

    private String AVAILABLE_INSTRUMENTS_LABEL = BlueSystem
            .getString("blueShare.availableInstruments");

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

    InstrumentOptionTableModel iTableModel = new InstrumentOptionTableModel();

    JPanel instrumentPanel = new JPanel();

    CardLayout cards = new CardLayout();

    JPanel instrCardPanel = new JPanel();

    CardLayout iListCard = new CardLayout();

    public InstrumentImportPane() {
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
                .setText(BlueSystem.getString("blueShare.importInstrument"));

        JScrollPane categoryScrollPane = new JScrollPane(categoryTree);

        this.add(mainSplitPane, BorderLayout.CENTER);
        mainSplitPane.add(categoriesPanel, JSplitPane.LEFT);
        categoriesPanel.add(categoryScrollPane, BorderLayout.CENTER);
        categoriesPanel.add(categoriesLabel, BorderLayout.NORTH);

        mainSplitPane.add(rightSplitPane, JSplitPane.RIGHT);
        rightSplitPane.add(iListPanel, JSplitPane.TOP);

        JLabel tempLabel = new JLabel(BlueSystem
                .getString("blueShare.noInstrumentsForCategory"));
        tempLabel.setHorizontalAlignment(SwingConstants.CENTER);

        JScrollPane instrScrollPane = new JScrollPane(instrumentTable);

        instrCardPanel.setLayout(iListCard);
        instrCardPanel.add(instrScrollPane, "iList");
        instrCardPanel.add(tempLabel, "none");

        iListPanel.add(instrCardPanel, BorderLayout.CENTER);
        iListPanel.add(iOptionsLabel, BorderLayout.NORTH);

        instrumentPanel.setLayout(cards);
        instrumentPanel.add(instrumentInfoPanel, "instrumentInfo");

        tempLabel = new JLabel(BlueSystem
                .getString("blueShare.selectInstrument"));
        tempLabel.setHorizontalAlignment(SwingConstants.CENTER);

        instrumentPanel.add(tempLabel, "blank");
        setInstrumentEnabled(false);

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
                    BlueShareInstrumentCategory tempCat = (BlueShareInstrumentCategory) tempNode
                            .getUserObject();

                    populateInstruments(tempCat);
                } catch (ClassCastException cce) {
                    // do nothing and ignore (top level root is just a string)
                }

            }
        });

        instrumentTable.getSelectionModel().addListSelectionListener((ListSelectionEvent e) -> {
            if (e.getValueIsAdjusting()) {
                return;
            }
            populateInstrument();
        });

        importButton.addActionListener((ActionEvent e) -> {
            importInstrument();
        });
    }

    private void populateInstruments(BlueShareInstrumentCategory category) {
        iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                + BlueSystem.getString("blueShare.loading"));
        try {

            InstrumentOption[] options;

            if (category.getCategoryId() == Integer.MIN_VALUE) {
                options = BlueShareRemoteCaller.getLatestTenInstruments();
            } else {
                options = BlueShareRemoteCaller.getInstrumentOptions(category);
            }

            iTableModel.setInstrumentOptions(options);
            setInstrumentEnabled(false);
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
            iTableModel.setInstrumentOptions(null);
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + BlueSystem.getString("message.error"));
            return;
        } catch (XmlRpcException xre) {
            String error = "Error: " + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setInstrumentOptions(null);
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + BlueSystem.getString("message.error"));
            return;
        } catch (IOException ioe) {
            String error = "Error: " + ioe.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setInstrumentOptions(null);
            iOptionsLabel.setText(AVAILABLE_INSTRUMENTS_LABEL + " - "
                    + BlueSystem.getString("message.error"));
            return;
        }
    }

    private void populateInstrument() {
        InstrumentOption iOption = iTableModel
                .getInstrumentOption(instrumentTable.getSelectedRow());
        if (iOption != null) {
            iNameText.setText(iOption.getName());
            iTypeText.setText(iOption.getType());
            userText.setText(iOption.getScreenName());
            iDescription.setText(iOption.getDescription());
        }
        setInstrumentEnabled(true);
    }

    private void setInstrumentEnabled(boolean val) {
        if (val) {
            cards.show(instrumentPanel, "instrumentInfo");
        } else {
            cards.show(instrumentPanel, "blank");
        }
    }

    private void importInstrument() {
        InstrumentOption iOption = iTableModel
                .getInstrumentOption(instrumentTable.getSelectedRow());
        if (iOption == null) {
            return;
        }

        try {
            Instrument instrument = BlueShareRemoteCaller
                    .getInstrument(iOption);

            if (instrument == null) {
                String error = BlueSystem.getString("blueShare.importError");
                JOptionPane.showMessageDialog(null, error, BlueSystem
                        .getString("message.error"), JOptionPane.ERROR_MESSAGE);
                return;

            }

            // data.getOrchestra().addInstrument(instrument);
            // instrumentTreeModel.reload();

            InstrumentLibrary instrLib = BlueSystem.getUserInstrumentLibrary();

            instrLib.importInstrument(instrument);

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

    /**
     * Passes in the categories retrieved from the server using
     * BlueShareRemoteCaller
     */

    public void setCategories(BlueShareInstrumentCategory[] categories) {
        DefaultMutableTreeNode root = new DefaultMutableTreeNode(BlueSystem
                .getString("common.categories"));

        BlueShareInstrumentCategory latestInstruments = new BlueShareInstrumentCategory(
                Integer.MIN_VALUE, ">Latest Instruments",
                "Newest Instruments in Repository", null);

        DefaultMutableTreeNode temp = new DefaultMutableTreeNode(
                latestInstruments);
        root.add(temp);

        addSubCategories(root, categories);
        categoryTree.setModel(new DefaultTreeModel(root));
    }

    private void addSubCategories(DefaultMutableTreeNode parent,
            BlueShareInstrumentCategory[] categories) {
        DefaultMutableTreeNode temp;

        for (int i = 0; i < categories.length; i++) {
            temp = new DefaultMutableTreeNode(categories[i]);
            parent.add(temp);
            addSubCategories(temp, categories[i].getSubCategories());
        }
    }

    public static void main(String[] args) {
        InstrumentImportPane instrumentImportPane1 = new InstrumentImportPane();
        blue.utility.GUI.showComponentAsStandalone(instrumentImportPane1,
                "Instrument Import Pane Test", true);
    }
}