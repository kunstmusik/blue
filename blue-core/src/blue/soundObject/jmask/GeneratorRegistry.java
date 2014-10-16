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
 * You should have received a copy of the GNU Library General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.soundObject.jmask;

/**
 * 
 * @author steven
 */
public class GeneratorRegistry {

    private static GeneratorEntry[] entries = null;

    public static GeneratorEntry[] getGeneratorEntries() {
        if (entries == null) {
            entries = new GeneratorEntry[] {
                    new GeneratorEntry("Constant", Constant.class),
                    new GeneratorEntry("Item List", ItemList.class),
                    new GeneratorEntry("Segment", Segment.class), 
                    new GeneratorEntry("Random", Random.class),
                    new GeneratorEntry("Probability", Probability.class),
                    new GeneratorEntry("Oscillator", Oscillator.class), };
        }

        return entries;
    }

    public static class GeneratorEntry {
        public final String generatorName;

        public final Class generatorClass;

        public GeneratorEntry(String name, Class clazz) {
            generatorName = name;
            generatorClass = clazz;
        }

        public String toString() {
            return generatorName;
        }

        public Generator createGenerator() {
            Generator retVal = null;

            try {
                retVal = (Generator) generatorClass.newInstance();
            } catch (IllegalAccessException ex) {
                ex.printStackTrace();
            } catch (InstantiationException ex) {
                ex.printStackTrace();
            }

            return retVal;
        }
    }
}
