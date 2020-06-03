/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.ceciliaModule.cybil;

import java.util.ArrayList;
import java.util.Iterator;

class CybilNode {

    public ArrayList args = new ArrayList();

    @Override
    public String toString() {
        return printVals(0);
    }

    public String printVals(int level) {
        StringBuffer buffer = new StringBuffer();

        String spacer = "";

        for (int i = 0; i < level * 2; i++) {
            spacer += ">";
        }

        for (Iterator iter = args.iterator(); iter.hasNext();) {
            Object arg = iter.next();

            if (arg instanceof CybilNode) {
                CybilNode node = (CybilNode) arg;
                buffer.append(node.printVals(level + 1));
            } else {
                buffer.append(spacer).append(arg).append("\n");
            }
        }
        return buffer.toString();
    }
}