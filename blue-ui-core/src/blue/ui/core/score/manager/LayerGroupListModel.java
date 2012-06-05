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
import javax.swing.AbstractListModel;
import javax.swing.event.ListDataListener;

/**
 *
 * @author stevenyi
 */
public class LayerGroupListModel extends AbstractListModel  {

    private Score score;
    
    private final ArrayList<ListDataListener> listeners = 
            new ArrayList<ListDataListener>();

    public LayerGroupListModel(Score score) {
        this.score = score;
    }
    
    @Override
    public int getSize() {
        return this.score.getLayerGroupCount();
    }

    @Override
    public Object getElementAt(int arg0) {
        return score.getLayerGroup(arg0);
    }
    
    public void addLayerGroup(int index, LayerGroup layerGroup) {
        score.addLayerGroup(index, layerGroup);
        fireIntervalAdded(this, index, index);
    }

    void removeLayerGroups(int minSelectionIndex, int maxSelectionIndex) {
        score.removeLayerGroups(minSelectionIndex, maxSelectionIndex);
        fireIntervalRemoved(this, minSelectionIndex, maxSelectionIndex);
    }

    void pushUpLayerGroups(int start, int end) {
        score.pushUpLayerGroups(start, end);
        fireContentsChanged(this, start - 1, end);
    }

    void pushDownLayerGroups(int start, int end) {
        score.pushDownLayerGroups(start, end);
        fireContentsChanged(this, start, end + 1);
    }

}
