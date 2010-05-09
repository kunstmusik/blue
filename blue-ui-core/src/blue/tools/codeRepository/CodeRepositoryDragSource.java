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

package blue.tools.codeRepository;

import java.awt.dnd.DragGestureEvent;
import java.awt.dnd.DragGestureListener;
import java.awt.dnd.DragGestureRecognizer;
import java.awt.dnd.DragSource;
import java.awt.dnd.DragSourceDragEvent;
import java.awt.dnd.DragSourceDropEvent;
import java.awt.dnd.DragSourceEvent;
import java.awt.dnd.DragSourceListener;

import javax.swing.JTree;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreePath;

/**
 * @author Steven Yi
 */
public class CodeRepositoryDragSource implements DragSourceListener,
        DragGestureListener {

    DragSource source;

    DragGestureRecognizer recognizer;

    TransferableTreeNode transferable;

    DefaultMutableTreeNode oldNode;

    JTree sourceTree;

    public CodeRepositoryDragSource(JTree tree, int actions) {
        sourceTree = tree;
        source = new DragSource();
        recognizer = source.createDefaultDragGestureRecognizer(sourceTree,
                actions, this);
    }

    // Drag gesture handler
    public void dragGestureRecognized(DragGestureEvent dge) {
        TreePath path = sourceTree.getSelectionPath();
        if ((path == null) || (path.getPathCount() <= 1)) {
            // We can't really move the root node (or an empty selection).
            return;
        }
        // Remember which node was dragged off so we can delete it to complete a
        // move
        // operation.
        oldNode = (DefaultMutableTreeNode) path.getLastPathComponent();

        // Make a version of the node that we can use in the DnD system.
        transferable = new TransferableTreeNode(path);

        // And start the drag process. We start with a no-drop cursor, assuming
        // that the
        // user won't want to drop the item right where she picked it up.
        source.startDrag(dge, null, transferable, this);

        // If you support dropping the node anywhere, you should probably start
        // with a
        // valid move cursor:
        // source.startDrag(dge, DragSource.DefaultMoveDrop, transferable,
        // this);
    }

    // Drag event handlers
    public void dragEnter(DragSourceDragEvent dsde) {

    }

    public void dragExit(DragSourceEvent dse) {
    }

    public void dragOver(DragSourceDragEvent dsde) {

    }

    public void dropActionChanged(DragSourceDragEvent dsde) {
    }

    public void dragDropEnd(DragSourceDropEvent dsde) {
        if (dsde.getDropSuccess()) {
            // Remove the node only if the drop was successful.
            ((DefaultTreeModel) sourceTree.getModel())
                    .removeNodeFromParent(oldNode);
        }
    }

}
