/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.blueLive;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.JButton;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

import blue.BlueSystem;
import blue.blueLive.LiveObject;

/**
 * 
 * @author steven
 */
public class LiveObjectsTableModel implements TableModel {

    ArrayList liveObjects = null;

    Vector tableListeners = null;

    /** Creates a new instance of LiveObjectsTableModel */
    public LiveObjectsTableModel() {
    }

    public void setLiveObjects(ArrayList liveObjects) {
        this.liveObjects = liveObjects;
        fireTableDataChanged();
    }

    public int getRowCount() {
        if (liveObjects == null) {
            return 0;
        }
        return liveObjects.size();
    }

    public int getColumnCount() {
        // return 5;
        return 3;
    }

    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return "Name";
            case 1:
                return "Type";
                // case 2:
                // return "MIDI Trigger";
                // case 3:
                // return "Key Trigger";
            case 2:
                return "Trigger";
        }

        return "xxx";
    }

    public Class getColumnClass(int columnIndex) {
        switch (columnIndex) {
            case 0:
            case 1:
                return String.class;
                // case 2:
                // return MidiKeyRenderer.class;
                // case 3:
                // return KeyboardKeyRenderer.class;
            case 2:
                return JButton.class;
        }
        return null;
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return columnIndex == 0 || columnIndex == 2;
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        if (liveObjects == null) {
            return null;
        }

        LiveObject liveObj = (LiveObject) liveObjects.get(rowIndex);

        if (rowIndex > liveObjects.size() - 1) {
            return null;
        }

        switch (columnIndex) {
            case 0:
                return liveObj.getSoundObject().getName();
            case 1:
                String name = liveObj.getSoundObject().getClass().getName();
                return BlueSystem.getShortClassName(name);
                // case 2:
                // return new Integer(liveObj.getMidiTrigger());
                // case 3:
                // return new Integer(liveObj.getKeyTrigger());
            case 2:
                return new Integer(rowIndex);
        }
        return null;
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if (columnIndex == 0) {
            LiveObject liveObj = (LiveObject) liveObjects.get(rowIndex);
            liveObj.getSoundObject().setName((String) aValue);
            fireTableDataChanged();
        }
    }

    /* TABLE MODEL LISTENER METHODS */

    public void addTableModelListener(TableModelListener l) {
        if (tableListeners == null) {
            tableListeners = new Vector();
        }
        tableListeners.add(l);
    }

    public void removeTableModelListener(TableModelListener l) {
        if (tableListeners == null) {
            return;
        }
        tableListeners.remove(l);
    }

    private void fireTableDataChanged() {
        if (tableListeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this);

        for (Iterator iter = tableListeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();

            listener.tableChanged(tme);
        }
    }

    /* DATA EDITING METHODS */

    public void addLiveObject(LiveObject liveObj) {
        if (liveObjects == null) {
            return;
        }

        liveObjects.add(liveObj);
        fireTableDataChanged();
    }

    public void addLiveObject(int index, LiveObject liveObj) {
        if (liveObjects == null) {
            return;
        }

        if (index >= 0 && index < liveObjects.size()) {
            liveObjects.add(index, liveObj);
            fireTableDataChanged();
        }
    }

    public void removeLiveObject(int index) {
        if (liveObjects == null) {
            return;
        }

        if (index >= 0 && index < liveObjects.size()) {
            liveObjects.remove(index);
            fireTableDataChanged();
        }
    }

    public void pushUp(int index) {
        if (index < 1 || index >= liveObjects.size()) {
            return;
        }

        Object obj = liveObjects.remove(index - 1);
        liveObjects.add(index, obj);

        fireTableDataChanged();
    }

    public void pushDown(int index) {
        if (liveObjects == null) {
            return;
        }

        if (index < 0 || index > liveObjects.size() - 2) {
            return;
        }

        Object obj = liveObjects.remove(index + 1);
        liveObjects.add(index, obj);

        fireTableDataChanged();
    }
}
