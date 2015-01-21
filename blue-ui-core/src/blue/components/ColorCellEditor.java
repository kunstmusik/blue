/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.components;

import java.awt.Color;
import java.awt.Component;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EventObject;
import java.util.List;
import javax.swing.JTable;
import javax.swing.event.CellEditorListener;
import javax.swing.event.ChangeEvent;
import javax.swing.table.TableCellEditor;

public class ColorCellEditor implements TableCellEditor {

    protected transient List<CellEditorListener> listeners = null;
    private ColorSelectionPanel panel = new ColorSelectionPanel();

    public ColorCellEditor() {
        panel.addPropertyChangeListener(new PropertyChangeListener() {
            @Override
            public void propertyChange(PropertyChangeEvent evt) {
                if (evt.getPropertyName().equals("colorSelectionValue")) {
                    fireEditingStopped();
                }
            }
        });
    }

    @Override
    public Object getCellEditorValue() {
        return panel.getColor();
    }

    @Override
    public boolean isCellEditable(EventObject anEvent) {
        return true;
    }

    @Override
    public boolean shouldSelectCell(EventObject anEvent) {
        return true;
    }

    @Override
    public boolean stopCellEditing() {
        fireEditingStopped();
        return true;
    }

    @Override
    public void cancelCellEditing() {
        fireEditingCanceled();
    }

    @Override
    public void addCellEditorListener(CellEditorListener l) {
        if (listeners == null) {
            listeners = Collections.synchronizedList(
                    new ArrayList<CellEditorListener>());
        }
        listeners.add(l);
    }

    @Override
    public void removeCellEditorListener(CellEditorListener l) {
        if (listeners == null) {
            return;
        }
        listeners.remove(l);
    }

    private void fireEditingCanceled() {
        if (listeners == null) {
            return;
        }

        ChangeEvent ce = new ChangeEvent(this);
        synchronized (listeners) {
            for (int i = listeners.size() - 1; i >= 0; i--) {
                CellEditorListener listener = listeners.get(i);
                listener.editingCanceled(ce);
            }
        }
    }

    private void fireEditingStopped() {
        if (listeners == null) {
            return;
        }

        ChangeEvent ce = new ChangeEvent(this);
        synchronized (listeners) {
            for (int i = listeners.size() - 1; i >= 0; i--) {
                CellEditorListener listener = listeners.get(i);
                listener.editingStopped(ce);
            }
        }
    }

    @Override
    public Component getTableCellEditorComponent(JTable table, Object value,
            boolean isSelected, int row, int column) {
        panel.setColor((Color) value);
        return panel;
    }
}
