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
package blue.orchestra.editor.blueSynthBuilder.swing;

import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JPopupMenu;

/**
 * @author steven
 */
public class BSBEditPanelNonEditPopup extends JPopupMenu {

    private final BSBEditPanel bsbEditPanel;

    public BSBEditPanelNonEditPopup(BSBEditPanel panel) {

        this.bsbEditPanel = panel;

        Action randomize = new AbstractAction("Randomize") {

            @Override
            public void actionPerformed(ActionEvent e) {
                bsbEditPanel.getBSBGraphicInterface().getRootGroup().randomize();
            }

        };

        this.add(randomize);
    }
}
