/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue;

import blue.orchestra.Instrument;
import blue.orchestra.InstrumentCategory;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;

/**
 * @author Steven Yi
 */
public class TransferableInstrument implements Transferable {

    public static DataFlavor INSTR_FLAVOR = new DataFlavor(Instrument.class,
            "Blue Instrument");

    public static DataFlavor INSTR_CAT_FLAVOR = new DataFlavor(
            InstrumentCategory.class, "Instrument Category");

    private Object obj;

    DataFlavor flavors[];

    public TransferableInstrument(Object obj) {
        this.obj = obj;

        if (obj instanceof Instrument) {
            flavors = new DataFlavor[] { INSTR_FLAVOR };
        } else if (obj instanceof InstrumentCategory) {
            flavors = new DataFlavor[] { INSTR_CAT_FLAVOR };
        } else {
            flavors = new DataFlavor[0];
        }
    }

    public DataFlavor[] getTransferDataFlavors() {
        return flavors;
    }

    public boolean isDataFlavorSupported(DataFlavor flavor) {
        if (flavors.length == 1) {
            return flavors[0].getRepresentationClass() == flavor
                    .getRepresentationClass();
        }

        return false;
    }

    public Object getTransferData(DataFlavor flavor)
            throws UnsupportedFlavorException, IOException {
        return obj;
    }

}
