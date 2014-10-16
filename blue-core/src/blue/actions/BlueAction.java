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
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.actions;

import blue.BlueSystem;
import java.awt.AWTKeyStroke;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.KeyStroke;

public abstract class BlueAction extends AbstractAction {

    public BlueAction(String resourceName) {
        String name = BlueSystem.getString(resourceName + ".text");
        String mnemonic = BlueSystem.getString(resourceName + ".mnemonic");

        if (mnemonic != null && mnemonic.length() > 0) {
            int index = name.indexOf(mnemonic.charAt(0));

            if (index >= 0) {
                AWTKeyStroke ks = KeyStroke.getAWTKeyStroke(mnemonic.charAt(0),
                        0);
                putValue(Action.MNEMONIC_KEY, new Integer(ks.getKeyCode()));
            }
        }

        putValue(NAME, name);
        putValue(SHORT_DESCRIPTION, name);
    }

    public BlueAction(String resourceName, KeyStroke keyStroke) {
        this(resourceName);
        putValue(ACCELERATOR_KEY, keyStroke);
    }
}
