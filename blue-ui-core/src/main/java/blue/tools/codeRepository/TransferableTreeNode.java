/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.tools.codeRepository;

// TransferableTreeNode.java
// A Transferable TreePath to be used with Drag & Drop applications.
//

import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import javax.swing.tree.TreePath;

public class TransferableTreeNode implements Transferable {

    public static DataFlavor TREE_PATH_FLAVOR = new DataFlavor(TreePath.class,
            "Tree Path");

    DataFlavor[] flavors = { TREE_PATH_FLAVOR };

    TreePath path;

    public TransferableTreeNode(TreePath tp) {
        path = tp;
    }

    @Override
    public synchronized DataFlavor[] getTransferDataFlavors() {
        return flavors;
    }

    @Override
    public boolean isDataFlavorSupported(DataFlavor flavor) {
        return (flavor.getRepresentationClass() == TreePath.class);
    }

    @Override
    public synchronized Object getTransferData(DataFlavor flavor)
            throws UnsupportedFlavorException, IOException {
        if (isDataFlavorSupported(flavor)) {
            return path;
        }
        throw new UnsupportedFlavorException(flavor);

    }
}