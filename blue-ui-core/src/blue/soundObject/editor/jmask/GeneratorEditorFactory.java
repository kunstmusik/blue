/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject.editor.jmask;

import blue.soundObject.jmask.Constant;
import blue.soundObject.jmask.Generator;
import blue.soundObject.jmask.ItemList;
import blue.soundObject.jmask.Oscillator;
import blue.soundObject.jmask.Probability;
import blue.soundObject.jmask.Random;
import blue.soundObject.jmask.Segment;
import javax.swing.JComponent;

/**
 *
 * @author syi
 */
public class GeneratorEditorFactory {

    public static JComponent getView(Generator generator) {
        if(generator instanceof Probability) {
            return new ProbabilityEditor((Probability)generator);
        } else if(generator instanceof Segment) {
            SegmentEditor editor = new SegmentEditor();
            editor.setSegment((Segment)generator);
            return editor;
        } else if(generator instanceof ItemList) {
            return new ItemListEditor((ItemList)generator);
        } else if(generator instanceof Oscillator) {
            return new OscillatorEditor((Oscillator)generator);
        } else if(generator instanceof Random) {
            return new RandomEditor((Random)generator);
        } else if(generator instanceof Constant) {
            return new ConstantEditor((Constant)generator);
        }

        return null;
    }
}
