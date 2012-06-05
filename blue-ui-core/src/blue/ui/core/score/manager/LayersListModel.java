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
import javax.swing.AbstractListModel;
import javax.swing.event.ListDataListener;

/**
 *
 * @author stevenyi
 */
public class LayersListModel extends AbstractListModel {

    private final LayerGroup layerGroup;

    public LayersListModel(LayerGroup layerGroup) {
        this.layerGroup = layerGroup;
    }
    
    @Override
    public int getSize() {
        return layerGroup.getSize();
    }

    @Override
    public Object getElementAt(int arg0) {
        return layerGroup.getLayerAt(arg0);
    }

    public void removeLayers(int start, int end) {
        layerGroup.removeLayers(start, end);
        fireIntervalRemoved(this, start, end);
    }

    public void newLayerAt(int index) {
        layerGroup.newLayerAt(index);
        fireIntervalAdded(this, index, index);
    }

    public void pushUpLayers(int start, int end) {
        layerGroup.pushUpLayers(start, end);
        fireContentsChanged(this, start - 1, end);
    }

    void pushDownLayers(int start, int end) {
        layerGroup.pushDownLayers(start, end);
        fireContentsChanged(this, start, end + 1);
    }
    
}
