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
package blue.ui.core.soundObject.renderer;

import blue.SoundLayer;
import blue.plugin.BarRendererPlugin;
import blue.soundObject.PianoRoll;
import blue.soundObject.pianoRoll.PianoNote;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
import java.awt.Graphics;
import java.util.ArrayList;
import java.util.Collections;

/**
 *
 * @author stevenyi
 */
@BarRendererPlugin(scoreObjectType = PianoRoll.class)
public class PianoRollRenderer extends GenericRenderer {
    
    @Override
    public void render(Graphics graphics, SoundObjectView sObjView, int pixelSeconds) {
        super.render(graphics, sObjView, pixelSeconds);
        
        if(sObjView.getHeight() <= SoundLayer.LAYER_HEIGHT) {
            return;
        }
        
        PianoRoll pianoRoll = (PianoRoll)sObjView.getSoundObject();
        
//        PianoRollValueCache cache = (PianoRollValueCache) sObjView.getClientProperty(this);
//        
//        if(cache != null) {
//            cac
//        }
        
        PianoRollValueCache cache = generateCache(pianoRoll);
        
        if(cache.range == 0) {
            return;
        }
    }
    
    protected PianoRollValueCache generateCache(PianoRoll pianoRoll) {
        PianoRollValueCache cache = new PianoRollValueCache();
        ArrayList<PianoNote> notes = pianoRoll.getNotes();
        
        if(notes.size() == 0) {
            cache.min = 0;
            cache.max = 0;
            cache.range = 0;
        } else {
            Collections.sort(notes);
        
            int scaleDegrees = pianoRoll.getScale().getNumScaleDegrees();
            PianoNote noteMin = notes.get(0);
            PianoNote noteMax = notes.get(notes.size() - 1);
            
            cache.min = (noteMin.getOctave() * scaleDegrees) + noteMin.getScaleDegree();
            cache.max = (noteMax.getOctave() * scaleDegrees) + noteMax.getScaleDegree();
            cache.range = cache.max - cache.min;
        }
        
        return cache;
    }

    class PianoRollValueCache {
        int max;
        int min;
        int range;
    }
    
}
