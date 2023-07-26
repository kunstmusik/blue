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
package blue.ui.core.score.layers.soundObject.library;

import blue.ui.core.score.layers.soundObject.library.SoundObjectLibraryUtils;
import blue.BlueData;
import blue.SoundLayer;
import blue.SoundObjectLibrary;
import blue.score.Score;
import blue.soundObject.GenericScore;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 *
 * @author stevenyi
 */
public class SoundObjectLibraryUtilsTest {
    
    public SoundObjectLibraryUtilsTest() {
    }

    /**
     * Test of removeLibrarySoundObject method, of class SoundObjectLibraryUtils.
     */
    @Test
    public void testRemoveLibrarySoundObject() {
        BlueData data = new BlueData();
        Score score = data.getScore();
        PolyObject polyObj = new PolyObject(true);
        score.add(polyObj);
        SoundObjectLibrary library = data.getSoundObjectLibrary();
        SoundLayer layer = polyObj.newLayerAt(0);
        
        SoundObject sObj = new GenericScore();
        SoundObject sObj2 = new GenericScore();
        PolyObject pObjInner = new PolyObject(true);
        SoundLayer layerInner = pObjInner.newLayerAt(0);
        layerInner.add(new Instance(sObj));
        
        layer.add(new Instance(sObj));
        layer.add(new Instance(sObj));
        layer.add(new Instance(sObj));
        layer.add(sObj2); 
        layer.add(pObjInner); 
        
        library.add(sObj);
       
        assertEquals(5, layer.size());
        assertEquals(1, library.size());
        assertEquals(1, layerInner.size());
        
        SoundObjectLibraryUtils.removeLibrarySoundObject(data, sObj);

        assertEquals(2, layer.size());
        assertEquals(0, library.size());
        assertEquals(0, layerInner.size());
    }
}