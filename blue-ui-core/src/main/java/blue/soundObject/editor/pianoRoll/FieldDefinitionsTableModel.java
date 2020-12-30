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

import blue.soundObject.PianoRoll;
import blue.soundObject.editor.pianoRoll.undo.UndoablePropertyEdit;
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import javax.swing.undo.UndoManager;

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

    private final Set<TableModelListener> listeners = new HashSet<>();
    private final UndoManager undoManager;
    private final PianoRoll pianoRoll;

    public FieldDefinitionsTableModel(PianoRoll pianoRoll,
            ObservableList<FieldDef> fieldDefinitions,
            UndoManager undoManager) {
        this.pianoRoll = pianoRoll;
        this.fieldDefinitions = fieldDefinitions;
        this.fieldDefinitions.addListener(this);
        this.undoManager = undoManager;
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
                    var oldVal = def.getFieldName();
                    def.setFieldName(sVal);

                    undoManager.addEdit(new UndoablePropertyEdit<String>(v -> {
                        def.setFieldName(v);
                        // should use listener on property but will go with this
                        // for now
                        fireTableModelChange(new TableModelEvent(this, rowIndex));
                    }, oldVal, sVal));
                }

            }
            break;
            case 1: {
                var oldVal = def.getFieldType();
                def.setFieldType((FieldType) aValue);
                undoManager.addEdit(new UndoablePropertyEdit<FieldType>(v -> {
                    def.setFieldType(v);
                    fireTableModelChange(new TableModelEvent(this, rowIndex));
                }, oldVal, (FieldType) aValue));

            }
            break;
            case 2: {
                final var oldVal = def.getMinValue();
                final var newVal = Double.parseDouble((String) aValue);
                if (oldVal != newVal) {
                    final var oldDefault = def.getDefaultValue();
                    Map<Field, Double> oldFieldValues = new HashMap<>();

                    for (var note : pianoRoll.getNotes()) {
                        var fld = note.getField(def);
                        fld.ifPresent(f -> oldFieldValues.put(f, f.getValue()));
                    }

                    def.setMinValue(newVal);

                    undoManager.addEdit(new UndoablePropertyEdit<Boolean>(v -> {
                        if (v) {
                            def.setMinValue(newVal);
                        } else {
                            def.setMinValue(oldVal);
                            def.setDefaultValue(oldDefault);
                            for (var entry : oldFieldValues.entrySet()) {
                                entry.getKey().setValue(entry.getValue());
                            }
                        }
                        fireTableModelChange(new TableModelEvent(this, rowIndex));
                    }, false, true));
                }
            }

            break;
            case 3: {
                final var oldVal = def.getMaxValue();
                final var newVal = Double.parseDouble((String) aValue);
                if (oldVal != newVal) {
                    final var oldDefault = def.getDefaultValue();
                    Map<Field, Double> oldFieldValues = new HashMap<>();

                    for (var note : pianoRoll.getNotes()) {
                        var fld = note.getField(def);
                        fld.ifPresent(f -> oldFieldValues.put(f, f.getValue()));
                    }

                    def.setMaxValue(newVal);

                    undoManager.addEdit(new UndoablePropertyEdit<Boolean>(v -> {
                        if (v) {
                            def.setMaxValue(newVal);
                        } else {
                            def.setMaxValue(oldVal);
                            def.setDefaultValue(oldDefault);
                            for (var entry : oldFieldValues.entrySet()) {
                                entry.getKey().setValue(entry.getValue());
                            }
                        }
                        fireTableModelChange(new TableModelEvent(this, rowIndex));
                    }, false, true));
                }
            }
            break;
            case 4: {
                var oldVal = def.getDefaultValue();
                final var newVal = Double.parseDouble((String) aValue);

                def.setDefaultValue(newVal);

                undoManager.addEdit(new UndoablePropertyEdit<Double>(v -> {
                    def.setDefaultValue(v);
                }, oldVal, newVal));
            }
            break;
            default:
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
