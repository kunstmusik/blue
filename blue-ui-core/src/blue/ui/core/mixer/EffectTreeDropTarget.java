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
package blue.ui.core.mixer;

import blue.mixer.*;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.datatransfer.Transferable;
import java.awt.dnd.DnDConstants;
import java.awt.dnd.DropTarget;
import java.awt.dnd.DropTargetContext;
import java.awt.dnd.DropTargetDragEvent;
import java.awt.dnd.DropTargetDropEvent;
import java.awt.dnd.DropTargetEvent;
import java.awt.dnd.DropTargetListener;

import javax.swing.JTree;
import javax.swing.tree.TreePath;

import blue.utility.ListUtil;

/**
 * @author steven
 */
public class EffectTreeDropTarget implements DropTargetListener {

    DropTarget target;

    JTree targetTree;

    public EffectTreeDropTarget(JTree tree) {
        targetTree = tree;
        target = new DropTarget(targetTree, this);
    }

    public void dragEnter(DropTargetDragEvent dtde) {
        if (!dtde.isDataFlavorSupported(TransferableEffect.EFFECT_FLAVOR)
                && !dtde
                        .isDataFlavorSupported(TransferableEffect.EFFECT_CAT_FLAVOR)) {
            dtde.rejectDrag();
            return;
        }
        Point p = dtde.getLocation();
        DropTargetContext dtc = dtde.getDropTargetContext();
        JTree tree = (JTree) dtc.getComponent();
        TreePath path = tree.getClosestPathForLocation(p.x, p.y);

        if (path.getLastPathComponent() instanceof EffectCategory) {
            dtde.acceptDrag(dtde.getDropAction());
        } else if (dtde.isDataFlavorSupported(TransferableEffect.EFFECT_FLAVOR)) {
            dtde.acceptDrag(dtde.getDropAction());
        } else {
            dtde.rejectDrag();
        }
    }

    public void dragOver(DropTargetDragEvent dtde) {
        dragEnter(dtde);
    }

    public void drop(DropTargetDropEvent dtde) {
        Point pt = dtde.getLocation();
        DropTargetContext dtc = dtde.getDropTargetContext();
        JTree tree = (JTree) dtc.getComponent();
        TreePath parentpath = tree.getClosestPathForLocation(pt.x, pt.y);
        Object node = parentpath.getLastPathComponent();

        EffectsLibrary eLibrary = EffectsLibrary.getInstance();

        if (dtde.isDataFlavorSupported(TransferableEffect.EFFECT_CAT_FLAVOR)) {
            if (!(node instanceof EffectCategory)) {
                dtde.rejectDrop();
                return;
            }

            if (dtde.getDropAction() == DnDConstants.ACTION_MOVE) {
                dtde.acceptDrop(dtde.getDropAction());

                Transferable tr = dtde.getTransferable();
                try {
                    Object transferNode = tr
                            .getTransferData(TransferableEffect.EFFECT_CAT_FLAVOR);

                    EffectCategory effectCategory = (EffectCategory) transferNode;
                    EffectCategory parentNode = (EffectCategory) node;

                    eLibrary.addCategory(parentNode, effectCategory);

                    dtde.dropComplete(true);
                } catch (Exception e) {
                    dtde.dropComplete(false);
                }
            } else {
                dtde.rejectDrop();
            }

        } else if (dtde.isDataFlavorSupported(TransferableEffect.EFFECT_FLAVOR)) {
            dtde.acceptDrop(dtde.getDropAction());

            try {
                Transferable tr = dtde.getTransferable();

                Object transferNode = tr
                        .getTransferData(TransferableEffect.EFFECT_FLAVOR);

                Effect effect = (Effect) transferNode;

                effect.clearParameters();

                // iLibrary.removeInstrument(instrument);
                if (node instanceof EffectCategory) {

                    EffectCategory parentNode = (EffectCategory) node;
                    eLibrary.addEffect(parentNode, effect);

                } else if (node instanceof Effect) {
                    EffectCategory parentNode = (EffectCategory) parentpath
                            .getPathComponent(parentpath.getPathCount() - 2);

                    int index = ListUtil.indexOfByRef(parentNode.getEffects(),
                            node);

                    int closestRow = tree.getClosestRowForLocation(pt.x, pt.y);

                    Rectangle bounds = tree.getRowBounds(closestRow);

                    if (pt.y > bounds.y + bounds.height) {
                        eLibrary.addEffect(parentNode, effect);
                    } else {
                        eLibrary.addEffect(parentNode, index, effect);
                    }

                }

                dtde.dropComplete(true);
            } catch (Exception e) {
                dtde.dropComplete(false);
            }
        } else {
            dtde.rejectDrop();
        }
    }

    public void dropActionChanged(DropTargetDragEvent dtde) {
    }

    public void dragExit(DropTargetEvent dte) {
    }

}