/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.ui.core.score.mouse;

import blue.SoundLayer;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.soundObject.GenericScore;
import blue.soundObject.SoundObject;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class MoveScoreObjectsListenerTest {
    
    public MoveScoreObjectsListenerTest() {
    }

    
    /**
     * Test of getMinYAdjust method, of class MoveScoreObjectsListener.
     */
    @Test
    public void testGetMinYAdjust() {
        System.out.println("getMinYAdjust");
        List<Layer> layers = new ArrayList<>();
        final SoundLayer soundLayer = new SoundLayer();
        ScoreObject scoreObj = new GenericScore();
        soundLayer.add((SoundObject)scoreObj);
        layers.add(new SoundLayer());
        layers.add(soundLayer);
        layers.add(new SoundLayer());

        int sObjLayerIndex = 1;

        int result = MoveScoreObjectsListener.getMinYAdjust(layers, scoreObj, sObjLayerIndex);
        assertEquals(-1, result);

        layers.add(0, new InvalidLayer());
        layers.add(1, new SoundLayer());
        layers.add(new InvalidLayer());
        sObjLayerIndex = 3;

        result = MoveScoreObjectsListener.getMinYAdjust(layers, scoreObj, sObjLayerIndex);
        assertEquals(-2, result);
    }

    /**
     * Test of getMaxYAdjust method, of class MoveScoreObjectsListener.
     */
    @Test
    public void testGetMaxYAdjust() {
        System.out.println("getMaxYAdjust");
        List<Layer> layers = new ArrayList<>();
        final SoundLayer soundLayer = new SoundLayer();
        ScoreObject scoreObj = new GenericScore();
        soundLayer.add((SoundObject)scoreObj);
        layers.add(new SoundLayer());
        layers.add(soundLayer);
        layers.add(new SoundLayer());

        int sObjLayerIndex = 1;

        int result = MoveScoreObjectsListener.getMaxYAdjust(layers, scoreObj, sObjLayerIndex);
        assertEquals(1, result);

        layers.add(0, new InvalidLayer());
        layers.add(1, new SoundLayer());
        layers.add(new InvalidLayer());
        sObjLayerIndex = 3;

        result = MoveScoreObjectsListener.getMaxYAdjust(layers, scoreObj, sObjLayerIndex);
        assertEquals(1, result);
    }

   

    static class InvalidLayer implements Layer {

        @Override
        public String getName() { return "test layer"; }

        @Override
        public void setName(String name) { }

        @Override
        public int getLayerHeight() { return -1; }

        @Override
        public boolean accepts(ScoreObject object) { return false; }

        @Override
        public boolean contains(ScoreObject object) { return false; }

        @Override
        public boolean remove(ScoreObject object) { return false; }
        
        @Override
        public int hashCode() {
            return System.identityHashCode(this);
        }

        @Override
        public boolean equals(Object obj) {
            return obj == this;
        }

        @Override
        public void clearScoreObjects() {
        }
    }
}
