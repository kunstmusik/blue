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
package blue.ui.core.orchestra;

import blue.InstrumentLibrary;
import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.Instrument;
import blue.orchestra.InstrumentCategory;
import blue.utility.ListUtil;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.dnd.DnDConstants;
import java.awt.dnd.DropTarget;
import java.awt.dnd.DropTargetContext;
import java.awt.dnd.DropTargetDragEvent;
import java.awt.dnd.DropTargetDropEvent;
import java.awt.dnd.DropTargetEvent;
import java.awt.dnd.DropTargetListener;
import java.io.IOException;
import javax.swing.JTree;
import javax.swing.tree.TreePath;

/**
 * @author steven
 */
public class InstrumentTreeDropTarget implements DropTargetListener {

    DropTarget target;

    JTree targetTree;

    public InstrumentTreeDropTarget(JTree tree) {
        targetTree = tree;
        target = new DropTarget(targetTree, this);
    }

    @Override
    public void dragEnter(DropTargetDragEvent dtde) {
        if (!dtde.isDataFlavorSupported(TransferableInstrument.INSTR_FLAVOR)
                && !dtde
                        .isDataFlavorSupported(TransferableInstrument.INSTR_CAT_FLAVOR)) {
            dtde.rejectDrag();
            return;
        }

        Point p = dtde.getLocation();
        DropTargetContext dtc = dtde.getDropTargetContext();
        JTree tree = (JTree) dtc.getComponent();
        TreePath path = tree.getClosestPathForLocation(p.x, p.y);

        if (path.getLastPathComponent() instanceof InstrumentCategory) {
            dtde.acceptDrag(dtde.getDropAction());
        } else if (dtde
                .isDataFlavorSupported(TransferableInstrument.INSTR_FLAVOR)) {
            dtde.acceptDrag(dtde.getDropAction());
        } else {
            dtde.rejectDrag();
        }
    }

    @Override
    public void dragOver(DropTargetDragEvent dtde) {
        dragEnter(dtde);
    }

    @Override
    public void drop(DropTargetDropEvent dtde) {
        Point pt = dtde.getLocation();
        DropTargetContext dtc = dtde.getDropTargetContext();
        JTree tree = (JTree) dtc.getComponent();
        TreePath parentpath = tree.getClosestPathForLocation(pt.x, pt.y);
        Object node = parentpath.getLastPathComponent();

        if (dtde.isDataFlavorSupported(TransferableInstrument.INSTR_CAT_FLAVOR)) {
            if (!(node instanceof InstrumentCategory)) {
                dtde.rejectDrop();
                return;
            }

            if (dtde.getDropAction() == DnDConstants.ACTION_MOVE) {
                dtde.acceptDrop(dtde.getDropAction());

                Transferable tr = dtde.getTransferable();
                try {
                    Object transferNode = tr
                            .getTransferData(TransferableInstrument.INSTR_CAT_FLAVOR);

                    InstrumentLibrary iLibrary = (InstrumentLibrary) tree
                            .getModel();

                    InstrumentCategory parentNode = (InstrumentCategory) node;

                    InstrumentCategory instrumentCategory = (InstrumentCategory) transferNode;

                    // iLibrary.removeCategory(instrumentCategory);
                    iLibrary.addCategory(parentNode, instrumentCategory);

                    dtde.dropComplete(true);
                } catch (UnsupportedFlavorException | IOException e) {
                    dtde.dropComplete(false);
                }
            } else {
                dtde.rejectDrop();
            }

        } else if (dtde
                .isDataFlavorSupported(TransferableInstrument.INSTR_FLAVOR)) {
            dtde.acceptDrop(dtde.getDropAction());

            try {
                Transferable tr = dtde.getTransferable();

                Object transferNode = tr
                        .getTransferData(TransferableInstrument.INSTR_FLAVOR);

                Instrument instrument = (Instrument) transferNode;
                InstrumentLibrary iLibrary = (InstrumentLibrary) tree
                        .getModel();

                if (instrument instanceof BlueSynthBuilder) {
                    ((BlueSynthBuilder) instrument).clearParameters();
                }

                // iLibrary.removeInstrument(instrument);
                if (node instanceof InstrumentCategory) {
                    InstrumentCategory parentNode = (InstrumentCategory) node;
                    iLibrary.addInstrument(parentNode, instrument);
                } else if (node instanceof Instrument) {
                    InstrumentCategory parentNode = (InstrumentCategory) parentpath
                            .getPathComponent(parentpath.getPathCount() - 2);

                    int index = ListUtil.indexOfByRef(parentNode
                            .getInstruments(), node);

                    int closestRow = tree.getClosestRowForLocation(pt.x, pt.y);

                    Rectangle bounds = tree.getRowBounds(closestRow);

                    if (pt.y > bounds.y + bounds.height) {
                        iLibrary.addInstrument(parentNode, instrument);
                    } else {
                        iLibrary.addInstrument(parentNode, index, instrument);
                    }
                }

                dtde.dropComplete(true);
            } catch (UnsupportedFlavorException | IOException e) {
                dtde.dropComplete(false);
            }
        } else {
            dtde.rejectDrop();
        }
    }

    @Override
    public void dropActionChanged(DropTargetDragEvent dtde) {
    }

    @Override
    public void dragExit(DropTargetEvent dte) {
    }

}