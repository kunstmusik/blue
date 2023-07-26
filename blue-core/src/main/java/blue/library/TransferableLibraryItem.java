/*
 * blue - object composition environment for csound
 * Copyright (C) 2020 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.library;

import blue.soundObject.SoundObject;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

/**
 *
 * @author stevenyi
 */
public class TransferableLibraryItem implements Transferable {

    public static DataFlavor LIBRARY_ITEM_FLAVOR = new DataFlavor(LibraryItem.class,
            "Blue LibraryItem");

    private static final DataFlavor[] FLAVORS = new DataFlavor[]{LIBRARY_ITEM_FLAVOR};

    private final LibraryItem item;

    public TransferableLibraryItem(LibraryItem item) {
        this.item = item;
    }

    @Override
    public DataFlavor[] getTransferDataFlavors() {
        return FLAVORS;
    }

    @Override
    public boolean isDataFlavorSupported(DataFlavor flavor) {
        return flavor != null && flavor.equals(LIBRARY_ITEM_FLAVOR);
    }

    @Override
    public Object getTransferData(DataFlavor flavor) throws UnsupportedFlavorException, IOException {
        return item;
    }
}
