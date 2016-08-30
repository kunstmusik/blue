/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.data.impl;

import blue.BlueDataObject;
import blue.data.BlueDataObjectLoadException;
import blue.data.BlueDataObjectLoader;
import blue.data.BlueDataObjectManager;
import electric.xml.Element;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.openide.util.Lookup;
import org.openide.util.LookupEvent;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author stevenyi
 */
@ServiceProvider(service = BlueDataObjectManager.class)
public class BlueDataObjectManagerImpl implements BlueDataObjectManager {

    Map<String, BlueDataObjectLoader> loaders = new HashMap<>(); 

    public BlueDataObjectManagerImpl() {
        final Lookup.Result<BlueDataObjectLoader> results = 
                Lookup.getDefault().lookupResult(BlueDataObjectLoader.class);

        updateLoaders(results.allInstances());
        
        results.addLookupListener((LookupEvent ev) -> {
                updateLoaders(results.allInstances());
        });
    }

    @Override
    public BlueDataObject loadFromXML(Element element) {

        String bdoType = element.getAttributeValue("bdoType");

        if (bdoType == null) {
            throw new BlueDataObjectLoadException("Invalid XML found: Could not find bdoType attribute.");
        }

        BlueDataObjectLoader loader = loaders.get(bdoType);
        if (loader == null) {
            throw new BlueDataObjectLoadException("Unable to find loader for BlueDataObject of type: " + bdoType);
        }

        return loader.loadFromXML(element);

    }

    private void updateLoaders(Collection<? extends BlueDataObjectLoader> allInstances) {

        for(BlueDataObjectLoader loader : allInstances) {
           loaders.put(loader.getBlueDataObjectClass().getName(), loader); 
        }
    }

}
