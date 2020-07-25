/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.pianoRoll;

import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import java.util.HashSet;
import java.util.Set;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

/**
 *
 * @author stevenyi
 */
public class FieldDefinitionsTableModel implements TableModel, ListChangeListener<FieldDef> {

    private static final String[] COL_NAMES = new String[]{
        "Field Name", "Field Type", "Min Value", "Max Value", "Default Value"
    };

    private static final Class[] COL_TYPES = new Class[]{
        String.class, FieldType.class, Double.class, Double.class, Double.class
    };

    private final ObservableList<FieldDef> fieldDefinitions;

    private Set<TableModelListener> listeners = new HashSet<>();

    public FieldDefinitionsTableModel(ObservableList<FieldDef> fieldDefinitions) {
        this.fieldDefinitions = fieldDefinitions;
        this.fieldDefinitions.addListener(this);
    }

    @Override
    public int getRowCount() {
        return fieldDefinitions.size();
    }

    @Override
    public int getColumnCount() {
        return 5;
    }

    @Override
    public String getColumnName(int columnIndex) {
        return COL_NAMES[columnIndex];
    }

    @Override
    public Class<?> getColumnClass(int columnIndex) {
        return COL_TYPES[columnIndex];
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        var def = fieldDefinitions.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return def.getFieldName();
            case 1:
                return def.getFieldType();
            case 2:
                return def.getMinValue();
            case 3:
                return def.getMaxValue();
            case 4:
                return def.getDefaultValue();
        }
        throw new IndexOutOfBoundsException(columnIndex);
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        var def = fieldDefinitions.get(rowIndex);

        switch (columnIndex) {
            case 0: {
                String sVal = (String) aValue;
                if (sVal != null && !sVal.isEmpty()) {
                    def.setFieldName(sVal);
                }
                break;
            }
            case 1:
                def.setFieldType((FieldType) aValue);
                break;
            case 2:
                def.setMinValue((double) aValue);
                break;
            case 3:
                def.setMaxValue((double) aValue);
                break;
            case 4:
                def.setDefaultValue((double) aValue);
                break;
            default:
                ;
        }

        TableModelEvent tme = new TableModelEvent(this, rowIndex, rowIndex, columnIndex);
        fireTableModelChange(tme);
    }

    @Override
    public void addTableModelListener(TableModelListener l) {
        listeners.add(l);
    }

    @Override
    public void removeTableModelListener(TableModelListener l) {
        listeners.remove(l);
    }

    protected void fireTableModelChange(TableModelEvent tme) {
        for (var listener : listeners) {
            listener.tableChanged(tme);
        }
    }

    @Override
    public void onChanged(Change<? extends FieldDef> change) {
        while (change.next()) {
            if (change.wasAdded()) {
                TableModelEvent tme = new TableModelEvent(this, change.getFrom(), change.getTo(), TableModelEvent.ALL_COLUMNS, TableModelEvent.INSERT);
                fireTableModelChange(tme);
            } else if (change.wasRemoved()) {
                TableModelEvent tme = new TableModelEvent(this, change.getFrom(), change.getTo(), TableModelEvent.ALL_COLUMNS, TableModelEvent.DELETE);
                fireTableModelChange(tme);
            }
        }
    }

    public void clearListener() {
        this.fieldDefinitions.removeListener(this);
    }
}
