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

package blue.orchestra.editor.blueSynthBuilder;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;

/**
 * Popup menu invoked when right-clicking on the file-selector widget.
 * @author Michael Bechard
 */
public class BSBFileSelectorPopup extends JPopupMenu implements ActionListener  {
    
    private BSBFileSelectorView fileView;
    
    private final JMenuItem itemClear = new JMenuItem("Clear");
    
    /**
     * Creates a new instance of BSBFileSelectorPopup
     * @param fileView The parent BSBFileSelectorView object
     */
    public BSBFileSelectorPopup(BSBFileSelectorView fileView) {
        this.fileView = fileView;
        
        itemClear.setActionCommand("Clear");
        itemClear.addActionListener(this);
        this.add(itemClear);
    }

    /**
     * Invoked when the Clear menu item is selected
     * @param e Event parameter
     */
    public void actionPerformed(ActionEvent e) {
        if (e.getActionCommand().equals("Clear")) {
            fileView.resetText();
        }
    }
}
