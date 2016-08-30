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
package blue.components.lines;

import blue.components.ColorCellEditor;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.TableModelListener;
import javax.swing.table.DefaultTableCellRenderer;

/**
 * @author steven
 */
public class LineListTable extends JComponent {

    JTable table;

    LineListTableModel tableModel = null;

    private SelectionListener<Line> listener;

    private LineList lineList;

    public LineListTable() {
        tableModel = getNewLineTableModel();
        this.setLayout(new BorderLayout());

        table = new JTable();
        table.setModel(tableModel);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        table.setDefaultRenderer(Color.class, new ColorCellRenderer());

        table.getSelectionModel().addListSelectionListener((ListSelectionEvent e) -> {
            if (listener != null && !e.getValueIsAdjusting()) {
                int row = table.getSelectedRow();
                
                SelectionEvent<Line> event;
                
                if (row == -1) {
                    event = new SelectionEvent<>(null,
                            SelectionEvent.SELECTION_REMOVE);
                } else {
                    Line line = lineList.get(row);
                    
                    event = new SelectionEvent<>(line,
                            SelectionEvent.SELECTION_SINGLE);
                }
                
                listener.selectionPerformed(event);
            }
        });

        table.getColumnModel().getColumn(0).setMaxWidth(40);
        table.getColumnModel().getColumn(1).setPreferredWidth(100);

        table.setDefaultEditor(Color.class, new ColorCellEditor());

        JPanel buttonPanel = new JPanel();
        buttonPanel.setLayout(new GridLayout(1, 2));

        JButton addButton = new JButton("+");
        addButton.addActionListener((ActionEvent e) -> {
            addLine();
        });

        JButton removeButton = new JButton("-");
        removeButton.addActionListener((ActionEvent e) -> {
            removeLine();
        });

        buttonPanel.add(addButton);
        buttonPanel.add(removeButton);

        this.add(new JScrollPane(table), BorderLayout.CENTER);
        this.add(buttonPanel, BorderLayout.SOUTH);

    }

    protected LineListTableModel getNewLineTableModel() {
        return new LineListTableModel();
    }

    private void addLine() {
        int row = table.getSelectedRow();
        tableModel.addLine(row);
    }

    private void removeLine() {
        int row = table.getSelectedRow();
        tableModel.removeLine(row);
    }

    public void setLineList(LineList lineList) {
        if (table.isEditing()) {
            table.getCellEditor().cancelCellEditing();
        }
        this.lineList = lineList;
        tableModel.setLineList(lineList);
    }

    public void addTableModelListener(TableModelListener listener) {
        tableModel.addTableModelListener(listener);
    }

    public void removeTableModelListener(TableModelListener listener) {
        tableModel.removeTableModelListener(listener);
    }

    /**
     * @param listener
     */
    public void addSelectionListener(SelectionListener<Line> listener) {
        this.listener = listener;
    }

}

class ColorCellRenderer extends DefaultTableCellRenderer {

    @Override
    public Component getTableCellRendererComponent(JTable table, Object value,
            boolean isSelected, boolean hasFocus, int row, int col) {

        if (value instanceof Color) {
            this.setBackground((Color) value);
        } else {
            this.setBackground(Color.BLACK);
        }

        return this;
    }
}