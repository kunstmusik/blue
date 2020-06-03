/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.blueLive;

import blue.blueLive.LiveObjectSet;
import blue.blueLive.LiveObjectSetList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

/**
 *
 * @author stevenyi
 */
public class LiveObjectSetListTableModel implements TableModel {

    Vector<TableModelListener> tableListeners = new Vector<>();
    private LiveObjectSetList liveObjectSetList;

    public void setLiveObjectSetList(LiveObjectSetList liveObjectSetList) {
        this.liveObjectSetList = liveObjectSetList;
        fireTableDataChanged(new TableModelEvent(this, TableModelEvent.HEADER_ROW));
    }
    
    @Override
    public int getRowCount() {
        return (this.liveObjectSetList == null) ? 0 : this.liveObjectSetList.size();
    }

    @Override
    public int getColumnCount() {
        return 1;
    }

    @Override
    public String getColumnName(int columnIndex) {
        return "Set";
    }

    @Override
    public Class<?> getColumnClass(int columnIndex) {
        return String.class;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return false;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        return liveObjectSetList.get(rowIndex).getName();
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        liveObjectSetList.get(rowIndex).setName((String) aValue);
    }

  /* TABLE MODEL LISTENER METHODS */

    @Override
    public void addTableModelListener(TableModelListener l) {
        if (tableListeners == null) {
            tableListeners = new Vector();
        }
        tableListeners.add(l);
    }

    @Override
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

    public void addLiveObjectSet(LiveObjectSet set) {
        liveObjectSetList.add(set);
        set.setName("Set " + liveObjectSetList.size());
        fireTableDataChanged();
    }
    
    public void removeLiveObjectSet(int index) {
        if(index >= 0 && index < liveObjectSetList.size()) {
            liveObjectSetList.remove(index);
            fireTableDataChanged();
        }
    }
    
    public void pushUpSet(int index) {
        LiveObjectSet set = liveObjectSetList.remove(index);
        liveObjectSetList.add(index - 1, set);
        fireTableDataChanged();
    }
    
    public void pushDownSet(int index) {
        LiveObjectSet set = liveObjectSetList.remove(index);
        liveObjectSetList.add(index + 1, set);
        fireTableDataChanged();
    }
}
