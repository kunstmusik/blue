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
package blue.clojure.soundObject;

import blue.CompileData;
import blue.noteProcessor.NoteProcessorChain;
import blue.soundObject.AbstractSoundObject;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObjectException;
import java.util.Map;

/**
 *
 * @author stevenyi
 */
public class ClojureSoundObject extends AbstractSoundObject {

    
    
    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) throws SoundObjectException {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public float getObjectiveDuration() {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public int getTimeBehavior() {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public float getRepeatPoint() {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void setRepeatPoint(float repeatPoint) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public electric.xml.Element saveAsXML(Map<Object, String> objRefMap) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        throw new UnsupportedOperationException("Not supported yet.");
    }
    
}
