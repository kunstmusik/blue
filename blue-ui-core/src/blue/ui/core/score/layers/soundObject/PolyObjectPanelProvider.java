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
package blue.ui.core.score.layers.soundObject;

import blue.BlueData;
import blue.score.TimeState;
import blue.score.layers.LayerGroup;
import blue.soundObject.PolyObject;
import blue.ui.core.score.layers.LayerGroupPanelProvider;
import javax.swing.JComponent;

/**
 *
 * @author stevenyi
 */
public class PolyObjectPanelProvider implements LayerGroupPanelProvider {

    PolyObjectPropertiesPanel propsPanel = null;
    
    @Override
    public JComponent getLayerGroupPanel(LayerGroup layerGroup,
            TimeState timeState, BlueData data) {
        
        if (layerGroup instanceof PolyObject) {
            ScoreTimeCanvas sTimeCanvas = new ScoreTimeCanvas(data);
            sTimeCanvas.setPolyObject((PolyObject) layerGroup, timeState);
            return sTimeCanvas;
        }
        return null;
    }

    @Override
    public JComponent getLayerGroupPropertiesPanel(LayerGroup layerGroup) {
        if (!(layerGroup instanceof PolyObject)) {
            return null;
        }
        
        if(propsPanel == null) {
             propsPanel = new PolyObjectPropertiesPanel();
        }
        propsPanel.setPolyObject((PolyObject)layerGroup);
        return propsPanel;
    }
}
