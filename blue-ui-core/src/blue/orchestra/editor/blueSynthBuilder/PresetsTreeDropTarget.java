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

import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import java.awt.Point;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
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
public class PresetsTreeDropTarget implements DropTargetListener {

    DropTarget target;

    JTree targetTree;

    public PresetsTreeDropTarget(JTree tree) {
        targetTree = tree;
        target = new DropTarget(targetTree, this);
    }

    @Override
    public void dragEnter(DropTargetDragEvent dtde) {
        Point p = dtde.getLocation();
        DropTargetContext dtc = dtde.getDropTargetContext();
        JTree tree = (JTree) dtc.getComponent();
        TreePath path = tree.getClosestPathForLocation(p.x, p.y);

        if (path.getLastPathComponent() instanceof PresetGroup) {
            dtde.acceptDrag(dtde.getSourceActions());
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

        if (!(node instanceof PresetGroup)) {
            dtde.rejectDrop();
            return;
        }

        try {
            Transferable tr = dtde.getTransferable();
            DataFlavor[] flavors = tr.getTransferDataFlavors();

            for (int i = 0; i < flavors.length; i++) {
                if (tr.isDataFlavorSupported(flavors[i])) {
                    dtde.acceptDrop(dtde.getDropAction());

                    Object transferNode = tr.getTransferData(flavors[i]);

                    PresetsTreeModel presetsTreeModel = (PresetsTreeModel) tree
                            .getModel();

                    PresetGroup parentNode = (PresetGroup) node;

                    if (transferNode instanceof Preset) {
                        Preset preset = (Preset) transferNode;

                        // presetsTreeModel.removePreset(preset);
                        presetsTreeModel.addPreset(parentNode, preset);

                        dtde.dropComplete(true);

                    } else if (transferNode instanceof PresetGroup) {

                        PresetGroup presetGroup = (PresetGroup) transferNode;

                        // presetsTreeModel.removePresetGroup(presetGroup);
                        presetsTreeModel
                                .addPresetGroup(parentNode, presetGroup);

                        dtde.dropComplete(true);

                    } else {
                        dtde.rejectDrop();
                    }

                    return;
                }
            }
            dtde.rejectDrop();
        } catch (UnsupportedFlavorException | IOException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void dropActionChanged(DropTargetDragEvent dtde) {
    }

    @Override
    public void dragExit(DropTargetEvent dte) {
    }

}