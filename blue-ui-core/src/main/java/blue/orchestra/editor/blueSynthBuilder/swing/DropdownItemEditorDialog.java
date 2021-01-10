/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.orchestra.blueSynthBuilder.BSBDropdownItem;
import blue.orchestra.blueSynthBuilder.BSBDropdownItemList;
import electric.xml.Element;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.table.AbstractTableModel;

/**
 * @author Steven Yi
 */
public class DropdownItemEditorDialog extends JDialog implements
        WindowSettingsSavable {

    BSBDropdownItemList items = null;

    DropdownItemsTableModel model = new DropdownItemsTableModel();

    JTable table;

    public DropdownItemEditorDialog() {
        this.setModal(true);

        this.getContentPane().setLayout(new BorderLayout());

        JPanel topPanel = new JPanel();
        topPanel.setLayout(new GridLayout(1, 4));

        JButton addButton = new JButton();
        JButton pushDownButton = new JButton();
        JButton pushUpButton = new JButton();
        JButton removeButton = new JButton();

        addButton.setText(BlueSystem.getString("common.add"));
        removeButton.setText(BlueSystem.getString("common.remove"));
        pushUpButton.setText(BlueSystem.getString("common.pushUp"));
        pushDownButton.setText(BlueSystem.getString("common.pushDown"));

        addButton.addActionListener((ActionEvent e) -> {
            addItem();
        });

        removeButton.addActionListener((ActionEvent e) -> {
            removeItem();
        });

        pushUpButton.addActionListener((ActionEvent e) -> {
            pushUpItem();
        });

        pushDownButton.addActionListener((ActionEvent e) -> {
            pushDownItem();
        });

        topPanel.add(addButton);
        topPanel.add(removeButton);
        topPanel.add(pushUpButton);
        topPanel.add(pushDownButton);

        table = new JTable(model);
        JScrollPane scrollPane = new JScrollPane(table);

        FlowLayout flowLayout = new FlowLayout(FlowLayout.CENTER);
        JPanel closePanel = new JPanel(flowLayout);

        JButton closeButton = new JButton(BlueSystem
                .getString("menu.file.close.text"));

        closeButton.addActionListener((ActionEvent e) -> {
            closeDialog();
        });

        closePanel.add(closeButton);

        this.getContentPane().add(topPanel, BorderLayout.NORTH);
        this.getContentPane().add(scrollPane, BorderLayout.CENTER);
        this.getContentPane().add(closePanel, BorderLayout.SOUTH);

        this.setSize(400, 300);

        WindowSettingManager.getInstance().registerWindow(
                "DropdownItemEditorDialog", this);

        this.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent arg0) {
                if (table.getCellEditor() != null) {
                    table.getCellEditor().stopCellEditing();
                }
            }
        });
    }

    /**
     * 
     */
    protected void closeDialog() {
        if (table.getCellEditor() != null) {
            table.getCellEditor().stopCellEditing();
        }
        this.dispose();
    }

    void addItem() {
        model.addDropdownItem();
    }

    void removeItem() {
        model.removeDropdownItem(table.getSelectedRow());
        table.clearSelection();
    }

    void pushUpItem() {
        model.pushUpItem(table.getSelectedRow());
        if (table.getSelectedRow() > 0) {
            table.setRowSelectionInterval(table.getSelectedRow() - 1, table
                    .getSelectedRow() - 1);
        }
    }

    void pushDownItem() {
        model.pushDownItem(table.getSelectedRow());
        if (table.getSelectedRow() < items.size() - 1) {
            table.setRowSelectionInterval(table.getSelectedRow() + 1, table
                    .getSelectedRow() + 1);
        }

    }

    public void show(BSBDropdownItemList items) {
        this.items = items;
        blue.utility.GUI.centerOnScreen(this);
        model.setDropdownItems(items);
        super.setVisible(true);

    }

    @Override
    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    @Override
    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }
}

final class DropdownItemsTableModel extends AbstractTableModel {

    private BSBDropdownItemList items;

    public DropdownItemsTableModel() {
        super();
    }

    public void setDropdownItems(BSBDropdownItemList items) {
        this.items = items;
        fireTableDataChanged();
    }

    public void addDropdownItem() {
        BSBDropdownItem item = new BSBDropdownItem();
        item.setName(BlueSystem.getString("propertyEditor.name"));
        item.setValue(BlueSystem.getString("propertyEditor.value"));
        items.add(item);
        fireTableRowsInserted(items.size() - 1, items.size() - 1);
    }

    public void removeDropdownItem(int index) {
        if (index < 0) {
            return;
        }
        items.remove(index);
        fireTableRowsDeleted(index, index);
    }

    public void pushUpItem(int index) {
        if (index > 0) {
            BSBDropdownItem a = items.remove(index - 1);
            items.add(index, a);
            this.fireTableRowsUpdated(index - 1, index);
        }
    }

    public void pushDownItem(int index) {
        if (index < items.size() - 1) {
            BSBDropdownItem a = items.remove(index + 1);
            items.add(index, a);
            this.fireTableRowsUpdated(index, index + 1);
        }
    }

    @Override
    public String getColumnName(int i) {
        if (i == 0) {
            return BlueSystem.getString("propertyEditor.name");
        } else if (i == 1) {
            return BlueSystem.getString("propertyEditor.value");
        }
        return null;
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public Object getValueAt(int row, int col) {
        BSBDropdownItem item = items.get(row);

        if (col == 0) {
            return item.getName();
        } else if (col == 1) {
            return item.getValue();
        } else {
            System.err
                    .println("error in DropdownItemsTableModel::getValueAt()");
            return null;
        }
    }

    @Override
    public int getRowCount() {
        if (items != null) {
            return items.size();
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
            BSBDropdownItem item = items.get(row);

            if (col == 0) {
                item.setName(val);
            } else if (col == 1) {
                item.setValue(val);
            }
        } catch (Exception e) {
            System.out.println("error in DropdownItemsModel: setValueAt");
            e.printStackTrace();
        }

        fireTableCellUpdated(row, col);
    }

}