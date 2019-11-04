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

import blue.blueLive.LiveObject;
import blue.blueLive.LiveObjectBins;
import blue.blueLive.LiveObjectSet;
import blue.soundObject.SoundObject;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

/**
 * 
 * @author steven
 */
public class LiveObjectsTableModel implements TableModel, ScoreObjectListener, 
        PropertyChangeListener {

    LiveObjectBins bins = null;

    Vector tableListeners = null;

    public void setLiveObjectBins(LiveObjectBins bins) {
        
        if(this.bins != null) {
            for(int i = 0; i < this.bins.getColumnCount(); i++) {
                for(int j = 0; j < this.bins.getRowCount(); j++) {
                    LiveObject lObj = this.bins.getLiveObject(i, j);
                    if(lObj != null && lObj.getSoundObject() != null) {
                        lObj.getSoundObject().removeScoreObjectListener(this);
                    }
                }
            }
            bins.removePropertyChangeListener(this);
        }
        
        this.bins = bins;
        
        for(int i = 0; i < bins.getColumnCount(); i++) {
            for(int j = 0; j < bins.getRowCount(); j++) {
                LiveObject lObj = bins.getLiveObject(i, j);
                if(lObj != null && lObj.getSoundObject() != null) {
                    lObj.getSoundObject().addScoreObjectListener(this);
                }
            }
        }
        
        fireTableDataChanged(new TableModelEvent(this, TableModelEvent.HEADER_ROW));
        bins.addPropertyChangeListener(this);
    }
    
    @Override
    public int getRowCount() {
        if (bins == null) {
            return 0;
        }
        return bins.getRowCount();
    }

    @Override
    public int getColumnCount() {
        if(bins == null) {
            return 0;
        }
        return bins.getColumnCount();
    }

    @Override
    public String getColumnName(int columnIndex) {
        return Integer.toString(columnIndex + 1);
    }

    @Override
    public Class getColumnClass(int columnIndex) {
        return LiveObject.class;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return false;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        if (bins == null || rowIndex < 0 || columnIndex < 0) {
            return null;
        }

        return (LiveObject) bins.getLiveObject(columnIndex, rowIndex);
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if(rowIndex >= 0 && rowIndex < bins.getRowCount() &&
                columnIndex >= 0 && columnIndex < bins.getColumnCount()) {
            
            LiveObject oldLiveObj = bins.getLiveObject(columnIndex, rowIndex);
            LiveObject newObj = (LiveObject)aValue;
            
            if(oldLiveObj != null && oldLiveObj.getSoundObject() != null) {
                oldLiveObj.getSoundObject().removeScoreObjectListener(this);
            }
            
            bins.setLiveObject(columnIndex, rowIndex, newObj);
            
            if(newObj != null && newObj.getSoundObject() != null) {
                newObj.getSoundObject().addScoreObjectListener(this);
            }
            
            fireTableDataChanged();
        }
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

    /* DATA EDITING METHODS */

    public void insertRow(int index) {
        bins.insertRow(index);
        fireTableDataChanged();
    }
    
    public void removeRow(int index) {
        bins.removeRow(index);
        fireTableDataChanged();
    }
    
    public void insertColumn(int index) {
        bins.insertColumn(index);
        fireTableDataChanged(new TableModelEvent(this, TableModelEvent.HEADER_ROW));
    }
    
    public void removeColumn(int index) {
        bins.removeColumn(index);
        fireTableDataChanged(new TableModelEvent(this, TableModelEvent.HEADER_ROW));
    }

    @Override
    public void scoreObjectChanged(ScoreObjectEvent event) {
        if(event.getPropertyChanged() == ScoreObjectEvent.NAME) {
            LiveObject lObj = getLiveObjectForSoundObject((SoundObject) 
                    event.getScoreObject());
            
            if(lObj != null) {
                int row = bins.getRowForObject(lObj);
                int column = bins.getColumnForObject(lObj);
                
                fireTableDataChanged(new TableModelEvent(this, row, row, column, TableModelEvent.UPDATE));
            }
        }
    }
    
    protected LiveObject getLiveObjectForSoundObject(SoundObject sObj) {
        if(this.bins == null) {
            return null;
        }
        
        for(int i = 0; i < bins.getColumnCount(); i++) {
            for(int j = 0; j < bins.getRowCount(); j++) {
                LiveObject lObj = bins.getLiveObject(i, j);
                
                if(lObj != null && lObj.getSoundObject() == sObj) {
                    return lObj;
                }
            }
        }
        
        return null;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if("enableStatedChanged".equals(evt.getPropertyName())) {
            fireTableDataChanged();
        }
    }

    public void setEnabled(LiveObjectSet lObjSet) {
        if(bins == null || lObjSet == null) {
            return;
        }
        
        for(int i = 0; i < bins.getColumnCount(); i++) {
            for(int j = 0; j < bins.getRowCount(); j++) {
                LiveObject lObj = bins.getLiveObject(i, j);
                
                if(lObj != null) {
                    lObj.setEnabled(lObjSet.contains(lObj));
                }
            }
        }
        fireTableDataChanged();
    }
}
