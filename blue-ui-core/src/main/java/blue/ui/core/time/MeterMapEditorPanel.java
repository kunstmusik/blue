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

import blue.time.MeasureMeterPair;
import blue.time.Meter;
import blue.time.MeterMap;

import javax.swing.*;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.TableCellRenderer;
import java.awt.*;

/**
 * Self-contained editor panel for MeterMap.
 * Works on a copy of the passed-in MeterMap.
 * 
 * @author stevenyi
 */
public class MeterMapEditorPanel extends JPanel {
    
    private final MeterMap meterMap;
    private final MeterMapTableModel tableModel;
    private final JTable table;
    
    public MeterMapEditorPanel(MeterMap sourceMap) {
        // Work on a copy
        this.meterMap = new MeterMap(sourceMap);
        this.tableModel = new MeterMapTableModel();
        this.table = new JTable(tableModel);
        
        initComponents();
    }
    
    private void initComponents() {
        setLayout(new BorderLayout(5, 5));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        // Table setup
        table.setRowHeight(24);
        table.getColumnModel().getColumn(0).setPreferredWidth(80);
        table.getColumnModel().getColumn(1).setPreferredWidth(120);
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
        addButton.addActionListener(e -> addMeterEntry());
        
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttonPanel.add(addButton);
        
        add(buttonPanel, BorderLayout.NORTH);
        add(scrollPane, BorderLayout.CENTER);
    }
    
    private void addMeterEntry() {
        // Find a reasonable measure for new entry
        long lastMeasure = meterMap.size() > 0 ? meterMap.get(meterMap.size() - 1).getMeasureNumber() : 0;
        long newMeasure = lastMeasure + 8;
        Meter defaultMeter = new Meter(4, 4);
        
        meterMap.add(new MeasureMeterPair(newMeasure, defaultMeter));
        tableModel.fireTableDataChanged();
    }
    
    private void deleteMeterEntry(int row) {
        if (meterMap.size() > 1 && row >= 0 && row < meterMap.size()) {
            meterMap.remove(row);
            tableModel.fireTableDataChanged();
        }
    }
    
    /**
     * Returns the edited MeterMap.
     */
    public MeterMap getMeterMap() {
        return meterMap;
    }
    
    /**
     * Shows a modal dialog to edit the given MeterMap.
     * 
     * @param parent the parent component for the dialog
     * @param sourceMap the MeterMap to edit
     * @return the edited MeterMap, or null if cancelled
     */
    public static MeterMap showDialog(Component parent, MeterMap sourceMap) {
        MeterMapEditorPanel panel = new MeterMapEditorPanel(sourceMap);
        
        int result = JOptionPane.showConfirmDialog(
            parent,
            panel,
            "Edit Time Signature Map",
            JOptionPane.OK_CANCEL_OPTION,
            JOptionPane.PLAIN_MESSAGE
        );
        
        if (result == JOptionPane.OK_OPTION) {
            return panel.getMeterMap();
        }
        return null;
    }
    
    /**
     * Table model for MeterMap editing.
     */
    private class MeterMapTableModel extends AbstractTableModel {
        
        private final String[] COLUMNS = {"Measure", "Time Signature", ""};
        
        @Override
        public int getRowCount() {
            return meterMap.size();
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
                case 0 -> Long.class;
                case 1, 2 -> String.class;
                default -> Object.class;
            };
        }
        
        @Override
        public boolean isCellEditable(int rowIndex, int columnIndex) {
            // All cells editable except delete button column when only 1 row
            if (columnIndex == 2) {
                return meterMap.size() > 1;
            }
            return true;
        }
        
        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            MeasureMeterPair pair = meterMap.get(rowIndex);
            return switch (columnIndex) {
                case 0 -> pair.getMeasureNumber();
                case 1 -> pair.getMeter().numBeats + "/" + pair.getMeter().beatLength;
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
            
            MeasureMeterPair pair = meterMap.get(rowIndex);
            
            try {
                if (columnIndex == 0) {
                    long newMeasure;
                    if (value instanceof Number) {
                        newMeasure = ((Number) value).longValue();
                    } else {
                        newMeasure = Long.parseLong(value.toString());
                    }
                    newMeasure = Math.max(1, newMeasure);
                    meterMap.set(rowIndex, pair.withMeasureNumber(newMeasure));
                } else if (columnIndex == 1) {
                    // Parse time signature like "4/4" or "3/4"
                    String sig = value.toString().trim();
                    String[] parts = sig.split("/");
                    if (parts.length == 2) {
                        int numBeats = Integer.parseInt(parts[0].trim());
                        int beatLength = Integer.parseInt(parts[1].trim());
                        if (numBeats > 0 && beatLength > 0 && isPowerOfTwo(beatLength)) {
                            meterMap.set(rowIndex, pair.withMeter(new Meter(numBeats, beatLength)));
                        }
                    }
                }
                fireTableDataChanged();
            } catch (NumberFormatException e) {
                // Ignore invalid input
            }
        }
        
        private boolean isPowerOfTwo(int n) {
            return n > 0 && (n & (n - 1)) == 0;
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
            setEnabled(meterMap.size() > 1);
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
                deleteMeterEntry(currentRow);
            });
        }
        
        @Override
        public Component getTableCellEditorComponent(JTable table, Object value,
                boolean isSelected, int row, int column) {
            currentRow = row;
            button.setEnabled(meterMap.size() > 1);
            return button;
        }
        
        @Override
        public Object getCellEditorValue() {
            return "Delete";
        }
    }
}
