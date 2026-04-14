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
        if(generator instanceof Probability probability) {
            return new ProbabilityEditor(probability);
        } else if(generator instanceof Segment segment) {
            SegmentEditor editor = new SegmentEditor();
            editor.setSegment(segment);
            return editor;
        } else if(generator instanceof ItemList itemList) {
            return new ItemListEditor(itemList);
        } else if(generator instanceof Oscillator oscillator) {
            return new OscillatorEditor(oscillator);
        } else if(generator instanceof Random random) {
            return new RandomEditor(random);
        } else if(generator instanceof Constant constant) {
            return new ConstantEditor(constant);
        }

        return null;
    }
}
