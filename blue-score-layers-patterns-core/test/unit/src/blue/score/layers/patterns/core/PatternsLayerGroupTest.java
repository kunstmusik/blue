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
package blue.score.layers.patterns.core;

import blue.CompileData;
import blue.soundObject.GenericScore;
import blue.soundObject.NoteList;
import org.junit.*;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class PatternsLayerGroupTest {
    
    public PatternsLayerGroupTest() {
    }

    /**
     * Test of generateForCSD method, of class PatternsLayerGroup.
     */
    @Test
    public void testGenerateForCSD() {
        CompileData compileData = null;
        float startTime = 4.0F;
        float endTime = 0.0F;
        PatternsLayerGroup instance = new PatternsLayerGroup();
        
        int patternBeatsLength = 4;
        instance.newLayerAt(-1);
        PatternLayer patternLayer = (PatternLayer)instance.getLayerAt(0);
        GenericScore score = new GenericScore();
        score.setText("i1 0 .25 1 2\ni1 1 .25 1 2");
        patternLayer.setSoundObject(score);
        patternLayer.getPatternData().setPattern(0, true);
        patternLayer.getPatternData().setPattern(1, true);
        patternLayer.getPatternData().setPattern(2, true);
        
        
        
        NoteList result = instance.generateForCSD(compileData, startTime,
                endTime, false);
        assertEquals(4, result.size());
        assertEquals("1.0", result.getNote(1).getPField(2));
        assertEquals("5.0", result.getNote(3).getPField(2));
       
    }

   
}
