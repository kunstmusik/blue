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
package blue.orchestra.editor.blueSynthBuilder;

import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;

import blue.orchestra.blueSynthBuilder.AutomatableBSBObject;

public abstract class AutomatableBSBObjectView extends BSBObjectView {

    public boolean isAutomationAllowed() {
        if (bsbObj == null) {
            return false;
        }
        return ((AutomatableBSBObject) bsbObj).isAutomationAllowed();
    }

    public void setAutomationAllowed(boolean val) {
        if (bsbObj == null) {
            return;
        }

        if (!val) {
            int retVal = JOptionPane.showConfirmDialog(SwingUtilities
                    .getRoot(this),
                    "Disabling Automation will delete any existing "
                            + "automation data for this parameter.\nPlease "
                            + "confirm disabling of automation.");

            if (retVal != JOptionPane.YES_OPTION) {
                // throw new PropertyVetoException(
                // "allowAutomation change cancelled",
                // new PropertyChangeEvent(this, "automationAllowed",
                // Boolean.valueOf(!val), Boolean.valueOf(val)));
                return;
            }
        }

        ((AutomatableBSBObject) bsbObj).setAutomationAllowed(val);
    }
}
