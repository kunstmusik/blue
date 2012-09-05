/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.ui.core.score.manager;

import blue.score.Score;
import blue.score.layers.LayerGroup;
import java.util.ArrayList;
import javax.swing.event.ListDataListener;
import javax.swing.table.AbstractTableModel;

/**
 *
 * @author stevenyi
 */
public class LayerGroupTableModel extends AbstractTableModel  {

    private Score score;
    
    private final ArrayList<ListDataListener> listeners = 
            new ArrayList<ListDataListener>();

    public LayerGroupTableModel(Score score) {
        this.score = score;
    }
    
    @Override
    public int getRowCount() {
        return this.score.getLayerGroupCount();
    }

    @Override
    public int getColumnCount() {
        return 1;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if(columnIndex == 0) {
            score.getLayerGroup(rowIndex).setName((String)aValue);
        }
    }
    
    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        return score.getLayerGroup(rowIndex).getName();
    }
    
    public void addLayerGroup(int index, LayerGroup layerGroup) {
        score.addLayerGroup(index, layerGroup);
        fireTableRowsInserted(index, index);
     }

    void removeLayerGroups(int minSelectionIndex, int maxSelectionIndex) {
        score.removeLayerGroups(minSelectionIndex, maxSelectionIndex);
        fireTableRowsDeleted(minSelectionIndex, maxSelectionIndex);
    }

    void pushUpLayerGroups(int start, int end) {
        score.pushUpLayerGroups(start, end);
        fireTableRowsUpdated(start - 1, end);
    }

    void pushDownLayerGroups(int start, int end) {
        score.pushDownLayerGroups(start, end);
        fireTableRowsUpdated(start, end + 1);
    }

    

}
