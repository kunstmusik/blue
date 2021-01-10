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
import java.awt.event.ActionListener;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;

import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.GridSettings;

/**
 * @author steven
 */
public class BSBEditPanelPopup extends JPopupMenu implements ActionListener {

    private BSBEditPanel bsbEditPanel;

    int itemX, itemY;

    private final JMenuItem paste = new JMenuItem("Paste");

    public BSBEditPanelPopup(BSBObjectEntry[] bsbObjectEntries) {
        for (int i = 0; i < bsbObjectEntries.length; i++) {
            BSBObjectEntry entry = bsbObjectEntries[i];

            JMenuItem item = new JMenuItem("Add " + entry.label);
            item.setActionCommand(entry.bsbObjectClass.getName());
            item.addActionListener(this);

            this.add(item);
        }

        paste.setActionCommand("Paste");
        paste.addActionListener(this);

        this.addSeparator();
        this.add(paste);
    }

    public void show(BSBEditPanel bsbEditPanel, int x, int y) {
        this.bsbEditPanel = bsbEditPanel;

        paste.setEnabled(bsbEditPanel.canPaste());

        this.itemX = x;
        this.itemY = y;

        if(bsbEditPanel != null && bsbEditPanel.getBSBGraphicInterface() != null) {
            GridSettings gridSettings = bsbEditPanel.getBSBGraphicInterface().getGridSettings();
            if(gridSettings.isSnapEnabled()) {
                final int width = gridSettings.getWidth();
                final int height = gridSettings.getHeight();
                
                itemX = (int)Math.floor((float)x / width) * width;
                itemY = (int)Math.floor((float)y / height) * height;
            }
        }

        super.show(bsbEditPanel, x, y);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        if (e.getActionCommand().equals("Paste")) {
            bsbEditPanel.paste(itemX, itemY);
            return;
        }

        // System.out.println("Adding BSBObject: " + e.getActionCommand());
        BSBObject bsbObj;

        try {
            bsbObj = (BSBObject) Class.forName(e.getActionCommand())
                    .newInstance();
            bsbObj.setX(itemX);
            bsbObj.setY(itemY);
            
            
            bsbEditPanel.addNewBSBObject(bsbObj);
        } catch (InstantiationException | IllegalAccessException | ClassNotFoundException e1) {
            e1.printStackTrace();
        }

    }
}
