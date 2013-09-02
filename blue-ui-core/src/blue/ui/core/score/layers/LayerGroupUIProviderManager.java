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
package blue.ui.core.score.layers;

import blue.BlueData;
import blue.score.TimeState;
import blue.score.layers.LayerGroup;
import java.util.ArrayList;
import javax.swing.JComponent;
import org.openide.util.Lookup;
import org.openide.util.lookup.Lookups;

/**
 *
 * @author stevenyi
 */
public class LayerGroupUIProviderManager extends ArrayList<LayerGroupUIProvider> {
      
    private static LayerGroupUIProviderManager instance = null;
    
    public static LayerGroupUIProviderManager getInstance() {
        if (instance == null) {
            instance = new LayerGroupUIProviderManager();
        }
        return instance;
    }

    public JComponent getLayerGroupPanel(LayerGroup layerGroup, TimeState timeState, BlueData data) {
        
        Lookup lkp = Lookups.forPath("blue/score/layers/uiProviders");
        
        for(LayerGroupUIProvider provider : lkp.lookupAll(
                LayerGroupUIProvider.class)) {
            JComponent comp = provider.getLayerGroupPanel(layerGroup, timeState, data);
            
            if(comp != null) {
                return comp;
            }
        }
        
        return null;
    }
    
    public JComponent getLayerGroupPropertiesPanel(LayerGroup layerGroup) {
        
        Lookup lkp = Lookups.forPath("blue/score/layers/uiProviders");
        
        for(LayerGroupUIProvider provider : lkp.lookupAll(
                LayerGroupUIProvider.class)) {
            JComponent comp = provider.getLayerGroupPropertiesPanel(layerGroup);
            
            if(comp != null) {
                return comp;
            }
        }
        
        return null;
    }
   
    public JComponent getLayerGroupHeaderPanel(LayerGroup layerGroup, TimeState timeState, BlueData data) {
        
        Lookup lkp = Lookups.forPath("blue/score/layers/uiProviders");
        
        for(LayerGroupUIProvider provider : lkp.lookupAll(
                LayerGroupUIProvider.class)) {
            JComponent comp = provider.getLayerGroupHeaderPanel(layerGroup, timeState, data);
            
            if(comp != null) {
                return comp;
            }
        }
        
        return null;
    }
}
