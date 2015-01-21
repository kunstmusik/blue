/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.tools.blueShare.instruments;

import blue.BlueSystem;
import javax.swing.table.AbstractTableModel;

/**
 * @author steven
 * 
 */
final class InstrumentOptionTableModel extends AbstractTableModel {
    InstrumentOption[] iOptions;

    public InstrumentOptionTableModel() {
    }

    public void setInstrumentOptions(InstrumentOption[] iOptions) {
        this.iOptions = iOptions;
        fireTableDataChanged();
    }

    public InstrumentOption getInstrumentOption(int index) {
        if (index >= iOptions.length || index < 0) {
            return null;
        }

        return iOptions[index];
    }

    @Override
    public String getColumnName(int i) {
        if (i == 0) {
            return BlueSystem.getString("propertyEditor.name");
        } else if (i == 1) {
            return BlueSystem.getString("blueShare.submittedBy");
        }
        return null;
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public Object getValueAt(int row, int col) {
        if (iOptions == null) {
            return null;
        }
        if (col == 0) {
            return iOptions[row].getName();
        }
        return iOptions[row].getScreenName();
    }

    @Override
    public int getRowCount() {
        if (iOptions == null) {
            return 0;
        }
        return iOptions.length;
    }

    @Override
    public boolean isCellEditable(int r, int c) {
        return false;
    }

    @Override
    public Class getColumnClass(int c) {
        return String.class;
    }

}
