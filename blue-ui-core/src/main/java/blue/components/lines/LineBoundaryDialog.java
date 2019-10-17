/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.components.lines;

import javax.swing.JOptionPane;

public class LineBoundaryDialog {
    public static final String RESCALE = "Rescale";

    public static final String TRUNCATE = "Truncate";

    public static String getLinePointMethod() {
        int retVal = JOptionPane.showOptionDialog(null,
                "Choose method for handling line points:",
                "Line Boundaries Changed", JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE, null, new Object[] { RESCALE,
                        TRUNCATE }, RESCALE);

        switch (retVal) {
            case 0:
                return RESCALE;
            case 1:
                return TRUNCATE;
        }

        return null;
    }
}
