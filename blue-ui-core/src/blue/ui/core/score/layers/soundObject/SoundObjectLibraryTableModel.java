/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score.layers.soundObject;

import javax.swing.table.AbstractTableModel;

import blue.BlueSystem;
import blue.SoundObjectLibrary;
import blue.soundObject.SoundObject;

class SoundObjectLibraryTableModel extends AbstractTableModel {

    SoundObjectLibrary sObjLib;

    static final String NAME = BlueSystem
            .getString("soundObjectLibrary.table.name");

    static final String TYPE = BlueSystem
            .getString("soundObjectLibrary.table.type");

    static final String INSTANCE_COUNT = BlueSystem
            .getString("soundObjectLibrary.table.instanceCount");

    public SoundObjectLibraryTableModel(SoundObjectLibrary sObjLib) {
        this.sObjLib = sObjLib;
    }

    public String getColumnName(int i) {
        switch (i) {
            case 0:
                return NAME;
            case 1:
                return TYPE;
            case 2:
                return INSTANCE_COUNT;
        }
        return BlueSystem.getString("message.error");
    }

    public int getColumnCount() {
        return 2;
    }

    public Object getValueAt(int row, int column) {
        if (sObjLib == null) {
            return null;
        }
        SoundObject sObj = sObjLib.getSoundObject(row);

        switch (column) {
            case 0:
                return sObj.getName();
            case 1:
                return BlueSystem.getShortClassName(sObj.getClass().getName());
            case 2:
                // need to add code to search BlueData for instances of this
                // sObj
                return BlueSystem.getString("common.notYetImplemented");
            default:
                return BlueSystem.getString("message.error");

        }
    }

    public int getRowCount() {
        return sObjLib.size();
    }

    public boolean isCellEditable(int r, int c) {
        if (c == 0) {
            return true;
        }
        return false;
    }

    public void setValueAt(Object value, int row, int col) {
        if (col == 0) {
            try {
                String val = (String) value;
                sObjLib.getSoundObject(row).setName(val);
            } catch (Exception e) {
                System.out.println("error in OrchestraTableModel: setValueAt");
                e.printStackTrace();
            }
        }
        fireTableCellUpdated(row, col);
    }

}