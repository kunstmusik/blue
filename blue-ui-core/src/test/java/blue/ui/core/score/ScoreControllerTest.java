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
package blue.ui.core.score;

import blue.SoundLayer;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.soundObject.GenericScore;
import blue.soundObject.PolyObject;
import blue.undo.BlueUndoManager;
import java.util.HashMap;
import javax.swing.JScrollPane;
import javax.swing.undo.UndoManager;
import org.junit.After;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.Before;
import org.openide.util.Lookup;
import org.openide.util.lookup.AbstractLookup;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class ScoreControllerTest {
    private ScoreController scoreController;
        
    public ScoreControllerTest() {
        BlueUndoManager.setUndoGroup(new HashMap<>());
    }

    @Before
    public void setUp() {
        System.out.println("@Before setUp");

        this.scoreController = ScoreController.getInstance();
        scoreController.setScrollPane(new JScrollPane());
        
        InstanceContent content = new InstanceContent();
        Score score = new Score();
        scoreController.setScore(score, 0.0);
        PolyObject pObj = (PolyObject) score.get(0);
        SoundLayer layer1 = new SoundLayer();
        SoundLayer layer2 = new SoundLayer();

        pObj.add(layer1);
        pObj.add(layer2);

        GenericScore score1 = new GenericScore();
        score1.setStartTime(2.0f);
        GenericScore score2 = new GenericScore();
        score2.setStartTime(4.0f);

        layer2.add(score1);
        layer2.add(score2);

        content.add(score);
        content.add(score1);
        content.add(score2);

        scoreController.setLookupAndContent(new AbstractLookup(content), content);

    }

    @After
    public void tearDown() {
        System.out.println("tear down");
    }
    /**
     * Test of getInstance method, of class ScoreController.
     */
    @Test
    public void testGetInstance() {
        ScoreController expResult = ScoreController.getInstance();
        ScoreController result = ScoreController.getInstance();
        assertEquals(expResult, result);
    }

    /**
     * Test of copyScoreObjects method, of class ScoreController.
     */
//    @Test
//    public void testCopyScoreObjects() {
//        scoreController.copyScoreObjects();
//
//        assertEquals(2, buffer.scoreObjects.size());
//        assertEquals(2, buffer.layerIndexes.size());
//
//        assertEquals(buffer.layerIndexes.get(0), buffer.layerIndexes.get(1));
//
//    }

    /**
     * Test of deleteScoreObjects method, of class ScoreController.
     */
    @Test
    public void testDeleteScoreObjects() {
       
        Score score = scoreController.getScore();
        PolyObject pObj = (PolyObject) score.get(0);
        Lookup lookup = scoreController.getLookup();
        
        assertEquals(2, pObj.get(1).size());
        assertEquals(2, lookup.lookupAll(ScoreObject.class).size());
        
        scoreController.deleteScoreObjects();

        assertEquals(0, pObj.get(1).size());
        assertEquals(0, lookup.lookupAll(ScoreObject.class).size());

    }

//    /**
//     * Test of cutScoreObjects method, of class ScoreController.
//     */
//    @Test
//    public void testCutScoreObjects() {
//        System.out.println("cut score objects");
//        Score score = scoreController.getScore();
//        PolyObject pObj = (PolyObject) score.get(0);
//        Lookup lookup = scoreController.getLookup();
//       
//        assertEquals(0, buffer.scoreObjects.size());
//        assertEquals(2, pObj.get(1).size());
//        assertEquals(2, lookup.lookupAll(ScoreObject.class).size());
//        
//        scoreController.cutScoreObjects();
//
//        assertEquals(2, buffer.scoreObjects.size());
//        assertEquals(0, pObj.get(1).size());
//        assertEquals(0, lookup.lookupAll(ScoreObject.class).size());
//    }

}
