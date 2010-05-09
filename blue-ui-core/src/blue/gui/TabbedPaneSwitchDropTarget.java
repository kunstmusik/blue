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
package blue.gui;

import java.awt.Point;
import java.awt.dnd.DropTargetAdapter;
import java.awt.dnd.DropTargetDragEvent;
import java.awt.dnd.DropTargetDropEvent;

import javax.swing.JTabbedPane;

public class TabbedPaneSwitchDropTarget extends DropTargetAdapter {
    private JTabbedPane tabs;

    public TabbedPaneSwitchDropTarget(JTabbedPane viewSelectPane) {
        this.tabs = viewSelectPane;
    }

    public void dragEnter(DropTargetDragEvent dtde) {
        Point p = dtde.getLocation();

        int index = tabs.indexAtLocation(p.x, p.y);

        if (index > 0) {
            tabs.setSelectedIndex(index);
        }

        dtde.rejectDrag();
    }

    public void dragOver(DropTargetDragEvent dtde) {
        dragEnter(dtde);
    }

    public void drop(DropTargetDropEvent dtde) {
        dtde.rejectDrop();
    }
}
