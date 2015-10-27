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
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.plaf;

import javax.swing.JComponent;
import javax.swing.JTable;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicTableUI;

public class BlueTableUI extends BasicTableUI {

    public static ComponentUI createUI(JComponent c) {
        return new BlueTableUI();
    }
    
    @Override
    public void installUI(JComponent c) {
        super.installUI(c);

        c.putClientProperty("terminateEditOnFocusLost", Boolean.TRUE);
        ((JTable)c).setRowHeight(24);
    }

}
