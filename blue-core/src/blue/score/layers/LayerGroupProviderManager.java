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
package blue.score.layers;

import blue.SoundObjectLibrary;
import blue.soundObject.PolyObjectLayerGroupProvider;
import electric.xml.Element;
import java.util.ArrayList;
import java.util.Collection;

/**
 *
 * @author stevenyi
 */
public class LayerGroupProviderManager extends ArrayList<LayerGroupProvider> {
     
    private static LayerGroupProviderManager instance = null;
    
    private LayerGroupProviderManager() {
        this.add(new PolyObjectLayerGroupProvider());
    }
    
    public static LayerGroupProviderManager getInstance() {
        if (instance == null) {
            instance = new LayerGroupProviderManager();
        }
        return instance;
    }
    
    public void updateProviders(Collection<? extends LayerGroupProvider> providers) {
        this.clear();
        this.add(new PolyObjectLayerGroupProvider());
        this.addAll(providers);
    }

    public LayerGroup loadFromXML(Element node, SoundObjectLibrary sObjLibrary) {
        LayerGroup layerGroup = null;
        
        for(LayerGroupProvider provider : this) {
            layerGroup = provider.loadFromXML(node, sObjLibrary);
            
            if(layerGroup != null) {
                break;
            }
        }
        
        return layerGroup;
    }
    
}
