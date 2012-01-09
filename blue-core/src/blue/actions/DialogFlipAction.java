/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.actions;

import blue.utility.GUI;
import java.awt.event.ActionEvent;
import javax.swing.JDialog;
import javax.swing.KeyStroke;

public class DialogFlipAction extends BlueAction {

    private JDialog dialog;

    public DialogFlipAction(String resourceName, JDialog dialog) {
        this(resourceName, dialog, null);
    }

    public DialogFlipAction(String resourceName, JDialog dialog,
            KeyStroke keyStroke) {
        super(resourceName);
        putValue(ACCELERATOR_KEY, keyStroke);

        this.dialog = dialog;
    }

    public void actionPerformed(ActionEvent e) {
        dialog.setVisible(!dialog.isShowing());
        GUI.adjustIfOffScreen(dialog);
    }
}
