package blue;

import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.ArrayList;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.table.AbstractTableModel;

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

public final class UserToolsDialog extends JDialog {
    ArrayList userTools;

    JPanel buttonPanel = new JPanel();

    JButton addButton = new JButton();

    GridLayout gridLayout1 = new GridLayout();

    JButton pushDownButton = new JButton();

    JButton pushUpButton = new JButton();

    JButton removeButton = new JButton();

    JScrollPane jScrollPane1 = new JScrollPane();

    JPanel bottomButtonPanel = new JPanel();

    JButton okButton = new JButton();

    JButton cancelButton = new JButton();

    JTable toolsTable = new JTable();

    public boolean isCancelled = false;

    UserToolsTableModel toolTableModel = new UserToolsTableModel();

    public UserToolsDialog() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public ArrayList getUpdatedUserTools() {
        return this.userTools;
    }

    public void show(ArrayList userTools) {
        this.userTools = userTools;
        toolTableModel.setUserTools(userTools);
        GUI.centerOnScreen(this);
        super.show();
    }

    public static void main(String[] args) {
        UserToolsDialog userToolsDialog1 = new UserToolsDialog();
        userToolsDialog1.show();
    }

    private void jbInit() throws Exception {
        this.setModal(true);
        this.setTitle(BlueSystem.getString("userTools.title"));

        this.getContentPane().setLayout(new BorderLayout());

        addButton.setText(BlueSystem.getString("common.add"));
        addButton.addActionListener((ActionEvent e) -> {
            addUserTool();
        });

        pushDownButton.setText(BlueSystem.getString("common.pushDown"));
        pushDownButton.addActionListener((ActionEvent e) -> {
            pushDownUserTool();
        });
        pushUpButton.setText(BlueSystem.getString("common.pushUp"));
        pushUpButton.addActionListener((ActionEvent e) -> {
            pushUpUserTool();
        });
        removeButton.setText(BlueSystem.getString("common.remove"));
        removeButton.addActionListener((ActionEvent e) -> {
            deleteUserTool();
        });

        buttonPanel.setLayout(gridLayout1);
        gridLayout1.setColumns(4);

        okButton.setText(BlueSystem.getString("programOptions.okButton"));
        okButton.addActionListener((ActionEvent e) -> {
            okButton_actionPerformed();
        });
        cancelButton.setText(BlueSystem
                .getString("programOptions.cancelButton"));
        cancelButton.addActionListener((ActionEvent e) -> {
            cancelButton_actionPerformed();
        });
        this.getContentPane().add(buttonPanel, BorderLayout.NORTH);
        buttonPanel.add(addButton, null);
        buttonPanel.add(removeButton, null);
        buttonPanel.add(pushUpButton, null);
        buttonPanel.add(pushDownButton, null);
        this.getContentPane().add(jScrollPane1, BorderLayout.CENTER);
        this.getContentPane().add(bottomButtonPanel, BorderLayout.SOUTH);

        bottomButtonPanel.add(okButton, null);
        bottomButtonPanel.add(cancelButton, null);

        jScrollPane1.getViewport().add(toolsTable, null);

        toolsTable.setModel(toolTableModel);

        this.setSize(600, 400);

        this.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent windowEvent) {
                isCancelled = true;
                dispose();
            }
        });

    }

    void addUserTool() {
        toolTableModel.addUserTool();
    }

    void deleteUserTool() {
        toolTableModel.removeUserTool(toolsTable.getSelectedRow());
        toolsTable.setRowSelectionInterval(-1, -1);
    }

    void pushUpUserTool() {
        toolTableModel.pushUpUserTool(toolsTable.getSelectedRow());
        if (toolsTable.getSelectedRow() > 0) {
            toolsTable.setRowSelectionInterval(toolsTable.getSelectedRow() - 1,
                    toolsTable.getSelectedRow() - 1);
        }
    }

    void pushDownUserTool() {
        toolTableModel.pushDownUserTool(toolsTable.getSelectedRow());
        if (toolsTable.getSelectedRow() < userTools.size() - 1) {
            toolsTable.setRowSelectionInterval(toolsTable.getSelectedRow() + 1,
                    toolsTable.getSelectedRow() + 1);
        }

    }

    void okButton_actionPerformed() {
        isCancelled = false;
        this.dispose();
    }

    void cancelButton_actionPerformed() {
        isCancelled = true;
        this.dispose();
    }
}

final class UserToolsTableModel extends AbstractTableModel {
    private ArrayList<UserTool> userTools;

    public UserToolsTableModel() {
        super();
    }

    public void setUserTools(ArrayList<UserTool> userTools) {
        this.userTools = userTools;
        fireTableDataChanged();
    }

    public void addUserTool() {
        UserTool tool = new UserTool();
        tool.name = BlueSystem.getString("userTools.newUserTool");
        tool.commandLine = "";
        userTools.add(tool);
        fireTableRowsInserted(userTools.size() - 1, userTools.size() - 1);
    }

    public void removeUserTool(int index) {
        if (index < 0) {
            return;
        }
        userTools.remove(index);
        fireTableRowsDeleted(index, index);
    }

    public void pushUpUserTool(int index) {
        if (index > 0) {
            UserTool a = userTools.remove(index - 1);
            userTools.add(index, a);
            this.fireTableRowsUpdated(index - 1, index);
        }
    }

    public void pushDownUserTool(int index) {
        if (index < userTools.size() - 1) {
            UserTool a = userTools.remove(index + 1);
            userTools.add(index, a);
            this.fireTableRowsUpdated(index, index + 1);
        }
    }

    @Override
    public String getColumnName(int i) {
        if (i == 0) {
            return BlueSystem.getString("userTools.toolName");
        } else if (i == 1) {
            return BlueSystem.getString("projectProperties.commandLine");
        }
        return null;
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public Object getValueAt(int row, int col) {
        UserTool tool = userTools.get(row);

        if (col == 0) {
            return tool.name;
        } else if (col == 1) {
            return tool.commandLine;
        } else {
            System.err.println("error in UserToolsTableModel");
            return null;
        }
    }

    @Override
    public int getRowCount() {
        if (userTools != null) {
            return userTools.size();
        }
        return 0;
    }

    @Override
    public boolean isCellEditable(int r, int c) {
        return true;
    }

    @Override
    public Class getColumnClass(int c) {
        return getValueAt(0, c).getClass();
    }

    @Override
    public void setValueAt(Object value, int row, int col) {
        try {
            String val = (String) value;
            UserTool tool = userTools.get(row);

            if (col == 0) {
                tool.name = val;
            } else if (col == 1) {
                tool.commandLine = val;
            }
        } catch (Exception e) {
            System.out.println("error in UserToolsTableModel: setValueAt");
            e.printStackTrace();
        }

        fireTableCellUpdated(row, col);
    }

}