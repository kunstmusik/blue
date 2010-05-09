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
package blue.soundObject.editor.jmask.probability;

import blue.soundObject.jmask.probability.Beta;
import blue.soundObject.jmask.probability.Cauchy;
import blue.soundObject.jmask.probability.Exponential;
import blue.soundObject.jmask.probability.Gaussian;
import blue.soundObject.jmask.probability.Linear;
import blue.soundObject.jmask.probability.ProbabilityGenerator;
import blue.soundObject.jmask.probability.Weibull;
import javax.swing.JComponent;

/**
 *
 * @author syi
 */
public class ProbabilityEditorFactory {

    public static JComponent getView(ProbabilityGenerator pGen) {
        if (pGen instanceof Beta) {
            new BetaEditor((Beta)pGen);
        } else if (pGen instanceof Cauchy) {
            return new CauchyEditor((Cauchy)pGen);
        } else if (pGen instanceof Exponential) {
            return new ExponentialEditor((Exponential)pGen);
        } else if (pGen instanceof Gaussian) {
            return new GaussianEditor((Gaussian)pGen);
        } else if (pGen instanceof Linear) {
            return new LinearEditor((Linear)pGen);
        } else if (pGen instanceof Weibull) {
            return new WeibullEditor((Weibull)pGen);
        }

        return null;
    }
}
