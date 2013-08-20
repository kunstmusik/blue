/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
import blue.SoundLayer;
import blue.SoundObjectLibrary;
import blue.score.Score;
import blue.score.layers.LayerGroup;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import java.util.ArrayList;

/**
 *
 * @author stevenyi
 */
public class SoundObjectLibraryUtils {
    public static void removeLibrarySoundObject(BlueData data, SoundObject sObj) {
        SoundObjectLibrary library = data.getSoundObjectLibrary();

        library.removeSoundObject(sObj);

        for (SoundObject tempObj : library) {
            if(tempObj instanceof PolyObject) {
                removeSoundObjectInstances((PolyObject)tempObj, sObj);
            } 
        }
       
        Score score = data.getScore();
        for(int i = 0; i < score.getLayerGroupCount(); i++) {
            LayerGroup layerGroup = score.getLayerGroup(i);

            if(layerGroup instanceof PolyObject) {
                PolyObject pObj = (PolyObject) layerGroup;
                removeSoundObjectInstances(pObj, sObj);
            }
        }

    } 

    protected static void removeSoundObjectInstances(PolyObject polyObject, SoundObject sObj) {
        for (int i = 0; i < polyObject.getSize(); i++) {
            SoundLayer layer = (SoundLayer) polyObject.getLayerAt(i);

            ArrayList<SoundObject> soundObjects = layer.getSoundObjects();
        
            ArrayList<SoundObject> instances = new ArrayList<>();
            
            for (SoundObject tempObject : soundObjects) {
                if(tempObject instanceof Instance) {
                    Instance instance = (Instance)tempObject;
                    if(instance.getSoundObject() == sObj) {
                        instances.add(instance);
                    }
                } else if (tempObject instanceof PolyObject) {
                    removeSoundObjectInstances((PolyObject)tempObject, sObj);
                } 
            }

            for (SoundObject tempObject : instances) {
                layer.removeSoundObject(tempObject);
            }
         }
    }
}
