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
 * @author Steven Yi
 */
public class BSBObjectEditPopup extends JPopupMenu implements ActionListener {
    private BSBEditPanel bsbEditPanel = null;

    private BSBObjectViewHolder viewHolder;

    private JMenuItem cut = new JMenuItem("Cut");

    private JMenuItem copy = new JMenuItem("Copy");

    // private JMenuItem paste = new JMenuItem("Paste");

    public BSBObjectEditPopup() {
        JMenuItem remove = new JMenuItem("Remove");

        remove.addActionListener(this);
        cut.addActionListener(this);
        copy.addActionListener(this);

        this.add(remove);
        this.addSeparator();
        this.add(cut);
        this.add(copy);
    }

    public void setBSBEditPanel(BSBEditPanel bsbEditPanel) {
        this.bsbEditPanel = bsbEditPanel;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        if (e.getActionCommand().equals("Cut")) {
            if (bsbEditPanel != null) {
                bsbEditPanel.cut();
            }
        } else if (e.getActionCommand().equals("Copy")) {
            if (bsbEditPanel != null) {
                bsbEditPanel.copy();
            }
        } else if (e.getActionCommand().equals("Remove")) {
            if (bsbEditPanel != null) {
                bsbEditPanel.removeSelectedBSBObjects();
            }
        }
    }

    public void show(BSBObjectViewHolder viewHolder, int x, int y) {
        this.viewHolder = viewHolder;

        super.show(viewHolder, x, y);
    }
}
