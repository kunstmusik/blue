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

package blue.tools.soundFont;

import java.util.ArrayList;

import javax.swing.table.AbstractTableModel;

public class PresetInfoTableModel extends AbstractTableModel {

    ArrayList presets = new ArrayList();

    public void addPresetInfo(PresetInfo info) {
        presets.add(info);
    }

    public int getColumnCount() {
        return 4;
    }

    public int getRowCount() {
        return presets.size();
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        PresetInfo info = (PresetInfo) presets.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return info.num;
            case 1:
                return info.name;
            case 2:
                return info.bank;
            case 3:
                return info.presetNum;
        }
        return null;
    }

    public String getColumnName(int index) {
        switch (index) {
            case 0:
                return "#";
            case 1:
                return "Preset";
            case 2:
                return "Bank";
            case 3:
            default:
                return "Preset #";
        }

    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        // TODO Auto-generated method stub

    }

}
