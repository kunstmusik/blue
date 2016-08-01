/*
 * LineTableModel.java
 *
 * Created on July 19, 2005, 8:42 AM
 */

package blue.components.lines;

import blue.BlueSystem;
import java.awt.Color;
import java.util.Iterator;
import javax.swing.JOptionPane;
import javax.swing.table.AbstractTableModel;

/**
 * Class extracted from LineTable file, originally written by Steven Yi
 * 
 * @author steven
 */
public class LineListTableModel extends AbstractTableModel {

    protected LineList lines = null;

    public void setLineList(LineList lines) {
        this.lines = lines;
        fireTableDataChanged();
    }

    public void removeLine(int index) {
        if (lines == null) {
            return;
        }

        if (index >= 0 && index < lines.size()) {
            lines.remove(index);
            fireTableRowsDeleted(index, index);
        }
    }

    public void addLine(int index) {
        if (lines == null) {
            return;
        }

        Line line = new Line();

        int lineNum = createUniqueLineNumber();

        line.setVarName("line" + lineNum);

        line.setColor(LineColors.getColor(lines.size()));

        if (index < 0 || index == lines.size() - 1) {
            lines.add(line);
            int row = lines.size() - 1;
            fireTableRowsInserted(row, row);
        } else {
            lines.add(index, line);
            fireTableRowsInserted(index, index);
        }
    }

    private int createUniqueLineNumber() {
        int lineNum = -1;

        for (int i = 0; i < lines.size(); i++) {
            String lineName = "line" + i;

            boolean found = true;

            for (int j = 0; j < lines.size() && found; j++) {
                Line l = lines.get(j);

                if ((!l.isZak()) && l.getVarName().equals(lineName)) {
                    found = false;
                }
            }

            if (found) {
                lineNum = i;
                break;
            }

        }

        if (lineNum == -1) {
            lineNum = lines.size();
        }
        return lineNum;
    }

    @Override
    public int getColumnCount() {
        return 5;
    }

    @Override
    public int getRowCount() {
        if (lines == null) {
            return 0;
        }
        return lines.size();
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        if (lines == null) {
            return null;
        }

        Line line = lines.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return line.getColor();
            case 1:
                return line.getVarName();
            case 2:
                return new Float(line.getMin());
            case 3:
                return new Float(line.getMax());
            case 4:
                return Boolean.valueOf(line.isEndPointsLinked());
        }
        return null;
    }

    @Override
    public boolean isCellEditable(int r, int c) {
        // return c != 0;
        return true;
    }

    @Override
    public Class<? extends Object> getColumnClass(int c) {
        switch (c) {
            case 0:
                return Color.class;
            case 1:
                return String.class;
            case 2:
            case 3:
                return Float.class;
            case 4:
                return Boolean.class;
        }
        return null;
    }

    @Override
    public void setValueAt(Object value, int row, int col) {
        Line line = lines.get(row);
        float fval;
        String retVal;

        switch (col) {
            case 0:
                line.setColor((Color) value);
                break;
            case 1:
                if (isLineNameAvailable((String) value)) {
                    line.setVarName((String) value);
                }
                break;
            case 2:
                fval = Float.parseFloat(value.toString());
                if (fval >= line.getMax()) {
                    JOptionPane.showMessageDialog(null, "Error: Min value "
                            + "can not be set greater or equals to Max value.",
                            "Error", JOptionPane.ERROR_MESSAGE);
                    return;
                }

                retVal = LineBoundaryDialog.getLinePointMethod();

                if (retVal == null) {
                    return;
                }

                line.setMin(fval, retVal.equals(LineBoundaryDialog.TRUNCATE));
                break;
            case 3:
                fval = Float.parseFloat(value.toString());
                if (fval <= line.getMin()) {
                    JOptionPane.showMessageDialog(null, "Error: Max value "
                            + "can not be set less than or "
                            + "equal to Min value.", "Error",
                            JOptionPane.ERROR_MESSAGE);

                    return;
                }

                retVal = LineBoundaryDialog.getLinePointMethod();

                if (retVal == null) {
                    return;
                }
                line.setMax(fval, retVal.equals(LineBoundaryDialog.TRUNCATE));
                break;
            case 4:
                boolean linked = ((Boolean)value).booleanValue();
                line.setEndPointsLinked(linked);
                
                if(linked) {
                    LinePoint first = line.getLinePoint(0);
                    LinePoint last = line.getLinePoint(line.getRowCount() - 1);
                    
                    last.setLocation(last.getX(), first.getY());
                }
                
                break;
        }

        fireTableCellUpdated(row, col);
    }

    private boolean isLineNameAvailable(String string) {
        for (Line line : lines) {
            if (line.getVarName().equals(string)) {
                return false;
            }
        }
        return true;
    }

    @Override
    public String getColumnName(int column) {
        String retVal;

        switch (column) {
            case 0:
                retVal = "[x]";
                break;
            case 1:
                retVal = BlueSystem.getString("lineObject.lineName");
                break;
            case 2:
                retVal = BlueSystem.getString("common.min");
                break;
            case 3:
                retVal = BlueSystem.getString("common.max");
                break;
            case 4:
                retVal = "Link First/Last";
                break;                
            default:
                retVal = "";
        }

        return retVal;
    }

}
