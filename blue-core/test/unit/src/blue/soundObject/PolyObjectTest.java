/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject;

import blue.SoundLayer;
import junit.framework.TestCase;

public class PolyObjectTest extends TestCase {

    public final void testIsScoreGenerationEmpty() {
        PolyObject pObj = new PolyObject();
        PolyObject pObj2 = new PolyObject();

        SoundLayer sLayer = new SoundLayer();
        SoundLayer sLayer2 = new SoundLayer();
        sLayer.addSoundObject(pObj2);
        pObj2.soundLayers.add(sLayer2);

        Comment comment = new Comment();
        GenericScore genScore = new GenericScore();

        assertTrue(pObj.isScoreGenerationEmpty());

        pObj.soundLayers.add(sLayer);

        assertTrue(pObj.isScoreGenerationEmpty());

        sLayer.addSoundObject(comment);
        assertTrue(pObj.isScoreGenerationEmpty());
        assertTrue(pObj2.isScoreGenerationEmpty());


        sLayer.removeSoundObject(comment);
        sLayer2.addSoundObject(comment);
        assertTrue(pObj.isScoreGenerationEmpty());
        assertTrue(pObj2.isScoreGenerationEmpty());

        sLayer.addSoundObject(genScore);

        assertFalse(pObj.isScoreGenerationEmpty());
        assertTrue(pObj2.isScoreGenerationEmpty());


        sLayer.removeSoundObject(genScore);
        sLayer2.addSoundObject(genScore);
        assertFalse(pObj.isScoreGenerationEmpty());
        assertFalse(pObj2.isScoreGenerationEmpty());
    }

    public void testGetAdjustedRenderStart() {
        PolyObject pObj = new PolyObject();
        SoundLayer sLayer = new SoundLayer();
        GenericScore genScore = new GenericScore();

        genScore.setStartTime(0.0f);
        genScore.setSubjectiveDuration(2.0f);

        pObj.soundLayers.add(sLayer);
        pObj.setRoot(true);
        pObj.setStartTime(1.0f);
        pObj.setSubjectiveDuration(2.0f);

        sLayer.addSoundObject(genScore);

        assertEquals(1.0f, pObj.getAdjustedRenderStart(1.0f), .0001f);
        assertEquals(2.0f, pObj.getAdjustedRenderStart(2.0f), .0001f);

        pObj.setRoot(false);

        assertEquals(0.0f, pObj.getAdjustedRenderStart(1.0f), .0001f);
        assertEquals(1.0f, pObj.getAdjustedRenderStart(2.0f), .0001f);

        genScore.setSubjectiveDuration(4.0f);

        assertEquals(0.0f, pObj.getAdjustedRenderStart(1.0f), .0001f);
        assertEquals(0.5f, pObj.getAdjustedRenderStart(2.0f), .0001f);
    }

    public void testGetAdjustedRenderEnd() {
        PolyObject pObj = new PolyObject();
        SoundLayer sLayer = new SoundLayer();
        GenericScore genScore = new GenericScore();

        genScore.setStartTime(0.0f);
        genScore.setSubjectiveDuration(2.0f);

        pObj.soundLayers.add(sLayer);
        pObj.setRoot(true);
        pObj.setStartTime(1.0f);
        pObj.setSubjectiveDuration(2.0f);

        sLayer.addSoundObject(genScore);

        assertEquals(1.0f, pObj.getAdjustedRenderEnd(1.0f), .0001f);
        assertEquals(2.0f, pObj.getAdjustedRenderEnd(2.0f), .0001f);
        assertEquals(-1.0f, pObj.getAdjustedRenderEnd(-1.0f), .0001f);

        pObj.setRoot(false);

        assertEquals(0.0f, pObj.getAdjustedRenderEnd(1.0f), .0001f);
        assertEquals(1.0f, pObj.getAdjustedRenderEnd(2.0f), .0001f);

        genScore.setSubjectiveDuration(4.0f);

        assertEquals(0.0f, pObj.getAdjustedRenderEnd(1.0f), .0001f);
        assertEquals(0.5f, pObj.getAdjustedRenderEnd(2.0f), .0001f);
        assertEquals(-1.0f, pObj.getAdjustedRenderEnd(3.0f), .0001f);


    }
}
