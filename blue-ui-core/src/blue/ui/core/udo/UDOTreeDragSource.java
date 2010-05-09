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
package blue.ui.core.udo;

import java.awt.dnd.DnDConstants;
import java.awt.dnd.DragGestureEvent;
import java.awt.dnd.DragGestureListener;
import java.awt.dnd.DragGestureRecognizer;
import java.awt.dnd.DragSource;
import java.awt.dnd.DragSourceDragEvent;
import java.awt.dnd.DragSourceDropEvent;
import java.awt.dnd.DragSourceEvent;
import java.awt.dnd.DragSourceListener;

import javax.swing.JTree;
import javax.swing.tree.TreePath;

import blue.gui.DragManager;
import blue.udo.UDOCategory;
import blue.udo.UDOLibrary;
import blue.udo.UserDefinedOpcode;
import blue.utility.ObjectUtilities;

/**
 * @author steven
 */
public class UDOTreeDragSource implements DragSourceListener,
        DragGestureListener {

    DragSource source;

    DragGestureRecognizer recognizer;

    JTree sourceTree;

    TransferableUDO transferable;

    Object oldNode;

    public UDOTreeDragSource(JTree tree, int actions) {
        sourceTree = tree;
        source = new DragSource();
        recognizer = source.createDefaultDragGestureRecognizer(sourceTree,
                actions, this);
    }

    public void dragGestureRecognized(DragGestureEvent dge) {
        TreePath path = sourceTree.getSelectionPath();
        if ((path == null) || (path.getPathCount() <= 1)) {
            // We can't really move the root node (or an empty selection).
            return;
        }

        if (path.getLastPathComponent() instanceof UserDefinedOpcode
                || path.getLastPathComponent() instanceof UDOCategory) {
            oldNode = path.getLastPathComponent();

            // USE CLONE OF OBJ AS TRANSFERRABLE ISN'T MAKING CLONE (WHY?)
            Object cloneNode = ObjectUtilities.clone(oldNode);

            transferable = new TransferableUDO(cloneNode);
            source.startDrag(dge, null, transferable, this);
            DragManager.setDragSource(sourceTree);
        }
    }

    public void dragDropEnd(DragSourceDropEvent dsde) {
        if (dsde.getDropSuccess()) {

            // System.out.println("DragSource: " + oldNode.hashCode());

            if (dsde.getDropAction() == DnDConstants.ACTION_MOVE) {

                if (oldNode instanceof UserDefinedOpcode) {

                    ((UDOLibrary) sourceTree.getModel())
                            .removeUDO((UserDefinedOpcode) oldNode);

                } else if (oldNode instanceof UDOCategory) {

                    ((UDOLibrary) sourceTree.getModel())
                            .removeCategory((UDOCategory) oldNode);

                }
            }

        }

        oldNode = null;
        DragManager.setDragSource(null);
    }

    public void dragEnter(DragSourceDragEvent dsde) {
    }

    public void dragOver(DragSourceDragEvent dsde) {
    }

    public void dropActionChanged(DragSourceDragEvent dsde) {
    }

    public void dragExit(DragSourceEvent dse) {
    }

}
