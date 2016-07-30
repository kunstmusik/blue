/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.jmask.probability;

import electric.xml.Element;
import javax.swing.JComponent;

public class Uniform implements ProbabilityGenerator {

    public static ProbabilityGenerator loadFromXML(Element data) {
        Uniform retVal = new Uniform();

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("probabilityGenerator");
        retVal.setAttribute("type", getClass().getName());

        return retVal;
    }

    public JComponent getEditor() {
        // TODO Auto-generated method stub
        return null;
    }

    public String getName() {
        return "Uniform";
    }

    public double getValue(double time, java.util.Random rnd) {
        return rnd.nextDouble();
    }

}
