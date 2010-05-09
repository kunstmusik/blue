/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.ftable;

import javax.swing.table.AbstractTableModel;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

class FTableTableModel extends AbstractTableModel {
    FTableSet ftables = new FTableSet();

    public FTableTableModel() {
    }

    public FTableTableModel(FTableSet ftables) {
        this.ftables = ftables;
    }

    public String getColumnName(int i) {
        switch (i) {
            case 0:
                return "FT #";

            case 1:
                return "Action Time";

            case 2:
                return "Table Size";

            case 3:
                return "Gen Routine";

            case 4:
                return "Name";

            default:
                return "";
        }
    }

    public int getColumnCount() {
        return 5;
    }

    public Object getValueAt(int row, int col) {
        FTable temp = (FTable) ftables.get(row);
        switch (col) {
            case 0:
                return new Integer(temp.getTableNumber());
            case 1:
                return new Integer(temp.getActionTime());
            case 2:
                return new Integer(temp.getTableSize());
            case 3:
                return new Integer(temp.getGenRoutine());
            case 4:
                return temp.getName();
            default:
                return null;
        }
    }

    public int getRowCount() {
        return ftables.size();
    }

    public boolean isCellEditable(int r, int c) {
        return false;

        /*
         * if(c == 0) { return true; } return false;
         */
    }

    /*
     * public Class getColumnClass(int c) { return getValueAt(0, c).getClass(); }
     */

    public void setValueAt(Object value, int row, int col) {
        /*
         * if(col == 0) { try { boolean val = ((Boolean)value).booleanValue();
         * Collection temp = ftables.values(); Iterator iter = temp.iterator();
         * Object a = null; int i = 0; while(iter.hasNext()) { a = iter.next();
         * if(i == row) { ((Instrument)a).setEnabled(val); } i++; } }
         * catch(Exception e) { System.out.println("error in
         * OrchestraTableModel: setValueAt"); e.printStackTrace(); } }
         * fireTableCellUpdated(row, col);
         */
    }
}
