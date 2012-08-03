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

import blue.score.layers.LayerGroup;
import javax.swing.table.AbstractTableModel;

/**
 *
 * @author stevenyi
 */
public class LayersTableModel extends AbstractTableModel {

    private final LayerGroup layerGroup;

    public LayersTableModel(LayerGroup layerGroup) {
        this.layerGroup = layerGroup;
    }
    
    @Override
    public int getRowCount() {
        return layerGroup.getSize();
    }

    @Override
    public int getColumnCount() {
        return 1;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        return layerGroup.getLayerAt(rowIndex);
    }
    
    public void removeLayers(int start, int end) {
        layerGroup.removeLayers(start, end);
        fireTableRowsDeleted(start, end);
    }

    public void newLayerAt(int index) {
        layerGroup.newLayerAt(index);
        fireTableRowsInserted(index, index);
    }

    public void pushUpLayers(int start, int end) {
        layerGroup.pushUpLayers(start, end);
        fireTableRowsUpdated(start - 1, end);
    }

    void pushDownLayers(int start, int end) {
        layerGroup.pushDownLayers(start, end);
        fireTableRowsUpdated(start, end + 1);
    }
    
}
