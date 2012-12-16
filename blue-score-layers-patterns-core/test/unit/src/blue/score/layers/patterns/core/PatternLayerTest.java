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
import blue.soundObject.SoundObjectException;
import electric.xml.Element;
import org.junit.*;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class PatternLayerTest {
    
    public PatternLayerTest() {
    }


    /**
     * Test of generateForCSD method, of class PatternLayer.
     */
    @Test
    public void testGenerateForCSD() throws SoundObjectException {
        CompileData compileData = null;
        float startTime = 0.0F;
        float endTime = 0.0F;
        int patternBeatsLength = 4;
        PatternLayer instance = new PatternLayer();
        GenericScore score = new GenericScore();
        score.setText("i1 0 .25 1 2\ni1 1 .25 1 2");
        instance.setSoundObject(score);
        instance.getPatternData().setPattern(0, true);
        instance.getPatternData().setPattern(1, true);
        instance.getPatternData().setPattern(2, true);
        NoteList result = instance.generateForCSD(compileData, startTime,
                endTime, patternBeatsLength);
        assertEquals(6, result.size());
        assertEquals("1.0", result.getNote(1).getPField(2));
        assertEquals("8.0", result.getNote(4).getPField(2));
        
        result = instance.generateForCSD(compileData, 4.0f,
                endTime, patternBeatsLength);
        assertEquals(4, result.size());
        
    }
}
