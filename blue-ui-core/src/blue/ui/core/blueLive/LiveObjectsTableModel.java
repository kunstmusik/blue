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

import java.util.Iterator;
import java.util.Vector;

import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

import blue.blueLive.LiveObject;
import blue.blueLive.LiveObjectBins;

/**
 * 
 * @author steven
 */
public class LiveObjectsTableModel implements TableModel {

    LiveObjectBins bins = null;

    Vector tableListeners = null;

    /** Creates a new instance of LiveObjectsTableModel */
    public LiveObjectsTableModel(LiveObjectBins bins) {
        this.bins = bins;
    }

    public int getRowCount() {
        if (bins == null) {
            return 0;
        }
        return bins.getRowCount();
    }

    public int getColumnCount() {
        if(bins == null) {
            return 0;
        }
        return bins.getColumnCount();
    }

    public String getColumnName(int columnIndex) {
        return Integer.toString(columnIndex + 1);
    }

    public Class getColumnClass(int columnIndex) {
        return LiveObject.class;
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return false;
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        if (bins == null || rowIndex < 0 || columnIndex < 0) {
            return null;
        }

        return (LiveObject) bins.getLiveObject(columnIndex, rowIndex);
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if(rowIndex >= 0 && rowIndex < bins.getRowCount() &&
                columnIndex >= 0 && columnIndex < bins.getColumnCount()) {
            bins.setLiveObject(columnIndex, rowIndex, (LiveObject)aValue);
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
        fireTableDataChanged(new TableModelEvent(this));
    }
    
    private void fireTableDataChanged(TableModelEvent tme) {
        if (tableListeners == null) {
            return;
        }

        for (Iterator iter = tableListeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();
            listener.tableChanged(tme);
        }
    }

    /* DATA EDITING METHODS */

    public void insertRow(int index) {
        bins.insertRow(index);
        fireTableDataChanged();
    }
    
    public void removeRow(int index) {
//        bins.removeRow(index);
//        fireTableDataChanged();
    }
    
    public void insertColumn(int index) {
        bins.insertColumn(index);
        fireTableDataChanged(new TableModelEvent(this, TableModelEvent.HEADER_ROW));
    }
    
    public void removeColumn(int index) {
        
    }
    
//    public void addLiveObject(LiveObject liveObj) {
//        if (liveObjects == null) {
//            return;
//        }
//
//        liveObjects.add(liveObj);
//        fireTableDataChanged();
//    }
//
//    public void addLiveObject(int index, LiveObject liveObj) {
//        if (liveObjects == null) {
//            return;
//        }
//
//        if (index >= 0 && index < liveObjects.size()) {
//            liveObjects.add(index, liveObj);
//            fireTableDataChanged();
//        }
//    }
//
//    public void removeLiveObject(int index) {
//        if (liveObjects == null) {
//            return;
//        }
//
//        if (index >= 0 && index < liveObjects.size()) {
//            liveObjects.remove(index);
//            fireTableDataChanged();
//        }
//    }
//
//    public void pushUp(int index) {
//        if (index < 1 || index >= liveObjects.size()) {
//            return;
//        }
//
//        Object obj = liveObjects.remove(index - 1);
//        liveObjects.add(index, obj);
//
//        fireTableDataChanged();
//    }
//
//    public void pushDown(int index) {
//        if (liveObjects == null) {
//            return;
//        }
//
//        if (index < 0 || index > liveObjects.size() - 2) {
//            return;
//        }
//
//        Object obj = liveObjects.remove(index + 1);
//        liveObjects.add(index, obj);
//
//        fireTableDataChanged();
//    }
}
