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
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.dnd.DragGestureEvent;
import java.awt.dnd.DragGestureListener;
import java.awt.dnd.DragGestureRecognizer;
import java.awt.dnd.DragSource;
import java.awt.dnd.DragSourceDragEvent;
import java.awt.dnd.DragSourceDropEvent;
import java.awt.dnd.DragSourceEvent;
import java.awt.dnd.DragSourceListener;
import java.io.IOException;
import javax.swing.JTree;
import javax.swing.tree.TreePath;

/**
 * @author steven
 */
public class PresetsTreeDragSource implements DragSourceListener,
        DragGestureListener {

    DragSource source;

    DragGestureRecognizer recognizer;

    JTree sourceTree;

    TransferablePreset transferable;

    Object oldNode;
    
    PresetGroup parent = null;

    public PresetsTreeDragSource(JTree tree, int actions) {
        sourceTree = tree;
        source = new DragSource();
        recognizer = source.createDefaultDragGestureRecognizer(sourceTree,
                actions, this);
    }

    @Override
    public void dragGestureRecognized(DragGestureEvent dge) {
        TreePath path = sourceTree.getSelectionPath();
        if ((path == null) || (path.getPathCount() <= 1)) {
            // We can't really move the root node (or an empty selection).
            return;
        }

        if (path.getLastPathComponent() instanceof Preset
                || path.getLastPathComponent() instanceof PresetGroup) {
            oldNode = path.getLastPathComponent();
            parent = (PresetGroup) path.getPathComponent(path.getPathCount() - 2);
            transferable = new TransferablePreset(oldNode);
            source.startDrag(dge, null, transferable, this);
        }
    }

    @Override
    public void dragDropEnd(DragSourceDropEvent dsde) {
        // TODO: Fix this all by changing preset/presetgroup to single 
        // PresetNode and revise code around all of this
//        if (dsde.getDropSuccess()) {
//
//            if (oldNode instanceof Preset) {
//
//                ((PresetsTreeModel) sourceTree.getModel())
//                        .removePreset((Preset) oldNode);
//
//            } else if (oldNode instanceof PresetGroup) {
//
//                ((PresetsTreeModel) sourceTree.getModel())
//                        .removePresetGroup((PresetGroup) oldNode);
//
//            }
//        }

        oldNode = null;
    }

    @Override
    public void dragEnter(DragSourceDragEvent dsde) {
    }

    @Override
    public void dragOver(DragSourceDragEvent dsde) {
    }

    @Override
    public void dropActionChanged(DragSourceDragEvent dsde) {
    }

    @Override
    public void dragExit(DragSourceEvent dse) {
    }

}

class TransferablePreset implements Transferable {

    private Object obj;

    public TransferablePreset(Object obj) {
        this.obj = obj;
    }

    public static DataFlavor PRESET_FLAVOR = new DataFlavor(Preset.class,
            "BSB Preset");

    public static DataFlavor PRESET_GROUP_FLAVOR = new DataFlavor(
            PresetGroup.class, "BSB Preset Group");

    DataFlavor[] flavors = { PRESET_FLAVOR, PRESET_GROUP_FLAVOR };

    @Override
    public DataFlavor[] getTransferDataFlavors() {
        return flavors;
    }

    @Override
    public boolean isDataFlavorSupported(DataFlavor flavor) {
        return flavor.getRepresentationClass() == Preset.class
                || flavor.getRepresentationClass() == PresetGroup.class;
    }

    @Override
    public Object getTransferData(DataFlavor flavor)
            throws UnsupportedFlavorException, IOException {
        return obj;
    }

}