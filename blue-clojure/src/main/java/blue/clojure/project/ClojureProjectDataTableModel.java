/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.clojure.project;

import javafx.collections.ListChangeListener;
import javax.swing.event.TableModelListener;
import javax.swing.table.AbstractTableModel;

/**
 *
 * @author stevenyi
 */
public class ClojureProjectDataTableModel extends AbstractTableModel implements ListChangeListener<ClojureLibraryEntry>{

    private static final String[] COL_NAMES = new String[] { "Library Coordinates", "Version" };
    
    private ClojureProjectData data = null;
    
    
    public ClojureProjectDataTableModel() {
        
    }
    
    public void setClojureProjectData(ClojureProjectData data) {
        
        if(this.data != null) {
            this.data.libraryList().removeListener(this);
        }
        
        this.data = data;
        
        this.data.libraryList().addListener(this);
        
        fireTableDataChanged();
    }
    

    @Override
    public int getRowCount() {
        return (data == null) ? 0 : data.libraryList().size();
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public String getColumnName(int columnIndex) {
        return COL_NAMES[columnIndex];
    }

    @Override
    public Class<?> getColumnClass(int columnIndex) {
        return String.class;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        if(data == null) return null;
        
        var entry = data.libraryList().get(rowIndex);
        
        switch(columnIndex) {
            case 0:
                return entry.getDependencyCoordinates();
            case 1:
                return entry.getVersion();
        }
        return null;
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
         if(data == null) return;
        
        var entry = data.libraryList().get(rowIndex);
        
        switch(columnIndex) {
            case 0:
                entry.setDependencyCoordinates((String)aValue);
                break;
            case 1:
                entry.setVersion((String)aValue);
                break;
        }
    }

    @Override
    public void onChanged(Change<? extends ClojureLibraryEntry> change) {
        // lazily just updating whole table...
        fireTableDataChanged();
    }

}
