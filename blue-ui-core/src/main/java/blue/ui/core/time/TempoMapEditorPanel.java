/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.ui.core.time;

import blue.time.TempoMap;
import blue.time.TempoPoint;

import javax.swing.*;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.TableCellRenderer;
import java.awt.*;

/**
 * Self-contained editor panel for TempoMap.
 * Works on a copy of the passed-in TempoMap.
 * 
 * @author stevenyi
 */
public class TempoMapEditorPanel extends JPanel {
    
    private final TempoMap tempoMap;
    private final TempoMapTableModel tableModel;
    private final JTable table;
    
    public TempoMapEditorPanel(TempoMap sourceMap) {
        // Work on a copy
        this.tempoMap = new TempoMap(sourceMap);
        this.tableModel = new TempoMapTableModel();
        this.table = new JTable(tableModel);
        
        initComponents();
    }
    
    private void initComponents() {
        setLayout(new BorderLayout(5, 5));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        // Table setup
        table.setRowHeight(24);
        table.getColumnModel().getColumn(0).setPreferredWidth(100);
        table.getColumnModel().getColumn(1).setPreferredWidth(100);
        table.getColumnModel().getColumn(2).setPreferredWidth(70);
        
        // Set up delete button column
        table.getColumnModel().getColumn(2).setCellRenderer(new ButtonRenderer());
        table.getColumnModel().getColumn(2).setCellEditor(new ButtonEditor());
        
        // Put table in editing mode when clicked
        table.putClientProperty("terminateEditOnFocusLost", Boolean.TRUE);
        
        JScrollPane scrollPane = new JScrollPane(table);
        scrollPane.setPreferredSize(new Dimension(320, 200));
        
        // Button panel
        JButton addButton = new JButton("Add");
        addButton.addActionListener(e -> addTempoPoint());
        
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttonPanel.add(addButton);
        
        add(buttonPanel, BorderLayout.NORTH);
        add(scrollPane, BorderLayout.CENTER);
    }
    
    private void addTempoPoint() {
        // Find a reasonable beat position for new point
        double lastBeat = tempoMap.size() > 0 ? tempoMap.getBeat(tempoMap.size() - 1) : 0;
        double newBeat = lastBeat + 4.0;
        double defaultTempo = tempoMap.size() > 0 ? tempoMap.getTempo(tempoMap.size() - 1) : 60.0;
        
        tempoMap.addTempoPoint(new TempoPoint(newBeat, defaultTempo));
        tableModel.fireTableDataChanged();
    }
    
    private void deleteTempoPoint(int row) {
        if (tempoMap.size() > 1 && row >= 0 && row < tempoMap.size()) {
            tempoMap.removeTempoPoint(row);
            tableModel.fireTableDataChanged();
        }
    }
    
    /**
     * Returns the edited TempoMap.
     */
    public TempoMap getTempoMap() {
        return tempoMap;
    }
    
    /**
     * Shows a modal dialog to edit the given TempoMap.
     * 
     * @param parent the parent component for the dialog
     * @param sourceMap the TempoMap to edit
     * @return the edited TempoMap, or null if cancelled
     */
    public static TempoMap showDialog(Component parent, TempoMap sourceMap) {
        TempoMapEditorPanel panel = new TempoMapEditorPanel(sourceMap);
        
        int result = JOptionPane.showConfirmDialog(
            parent,
            panel,
            "Edit Tempo Map",
            JOptionPane.OK_CANCEL_OPTION,
            JOptionPane.PLAIN_MESSAGE
        );
        
        if (result == JOptionPane.OK_OPTION) {
            return panel.getTempoMap();
        }
        return null;
    }
    
    /**
     * Table model for TempoMap editing.
     */
    private class TempoMapTableModel extends AbstractTableModel {
        
        private final String[] COLUMNS = {"Beat", "Tempo (BPM)", ""};
        
        @Override
        public int getRowCount() {
            return tempoMap.size();
        }
        
        @Override
        public int getColumnCount() {
            return COLUMNS.length;
        }
        
        @Override
        public String getColumnName(int column) {
            return COLUMNS[column];
        }
        
        @Override
        public Class<?> getColumnClass(int columnIndex) {
            return switch (columnIndex) {
                case 0, 1 -> Double.class;
                case 2 -> String.class;
                default -> Object.class;
            };
        }
        
        @Override
        public boolean isCellEditable(int rowIndex, int columnIndex) {
            // All cells editable except delete button column when only 1 row
            if (columnIndex == 2) {
                return tempoMap.size() > 1;
            }
            return true;
        }
        
        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            return switch (columnIndex) {
                case 0 -> tempoMap.getBeat(rowIndex);
                case 1 -> tempoMap.getTempo(rowIndex);
                case 2 -> "Delete";
                default -> null;
            };
        }
        
        @Override
        public void setValueAt(Object value, int rowIndex, int columnIndex) {
            if (columnIndex == 2) {
                // Delete handled by button editor
                return;
            }
            
            try {
                double newValue;
                if (value instanceof Number) {
                    newValue = ((Number) value).doubleValue();
                } else {
                    newValue = Double.parseDouble(value.toString());
                }
                
                double beat = tempoMap.getBeat(rowIndex);
                double tempo = tempoMap.getTempo(rowIndex);
                
                if (columnIndex == 0) {
                    beat = Math.max(0, newValue);
                } else if (columnIndex == 1) {
                    tempo = Math.max(1, newValue);
                }
                
                tempoMap.setTempoPoint(rowIndex, beat, tempo);
                fireTableDataChanged();
            } catch (NumberFormatException e) {
                // Ignore invalid input
            }
        }
    }
    
    /**
     * Renderer for delete button column.
     */
    private class ButtonRenderer extends JButton implements TableCellRenderer {
        public ButtonRenderer() {
            setOpaque(true);
        }
        
        @Override
        public Component getTableCellRendererComponent(JTable table, Object value,
                boolean isSelected, boolean hasFocus, int row, int column) {
            setText("Delete");
            setEnabled(tempoMap.size() > 1);
            return this;
        }
    }
    
    /**
     * Editor for delete button column.
     */
    private class ButtonEditor extends DefaultCellEditor {
        private final JButton button;
        private int currentRow;
        
        public ButtonEditor() {
            super(new JCheckBox());
            button = new JButton("Delete");
            button.setOpaque(true);
            button.addActionListener(e -> {
                fireEditingStopped();
                deleteTempoPoint(currentRow);
            });
        }
        
        @Override
        public Component getTableCellEditorComponent(JTable table, Object value,
                boolean isSelected, int row, int column) {
            currentRow = row;
            button.setEnabled(tempoMap.size() > 1);
            return button;
        }
        
        @Override
        public Object getCellEditorValue() {
            return "Delete";
        }
    }
}
