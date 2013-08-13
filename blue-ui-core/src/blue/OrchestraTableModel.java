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

package blue;

import blue.orchestra.Instrument;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.Set;
import java.util.TreeMap;
import javax.swing.table.AbstractTableModel;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public final class OrchestraTableModel extends AbstractTableModel {
    Orchestra orch;

    TreeMap orchTree = new TreeMap();

    public OrchestraTableModel() {
    }

    @Override
    public String getColumnName(int i) {
        if (i == 0) {
            return "[X]";
        } else if (i == 1) {
            return BlueSystem.getString("orchestraTable.instrumentNumber");
        } else {
            return BlueSystem.getString("orchestraTable.instrumentName");
        }
    }

    @Override
    public int getColumnCount() {
        return 3;
    }

    @Override
    public Object getValueAt(int parm1, int parm2) {
        if (orchTree == null) {
            return null;
        }
        if (parm2 == 0) {
            Collection temp = orchTree.values();
            Iterator iter = temp.iterator();
            Object a = null;
            int i = 0;
            while (iter.hasNext()) {
                a = iter.next();
                if (i == parm1) {
                    if (((Instrument) a).isEnabled()) {
                        return Boolean.TRUE;
                    }
                    return Boolean.FALSE;

                    /*
                     * if(((Instrument)a).isEnabled()) { return "x"; } return
                     * "";
                     */
                }
                i++;
            }
            return null;
        } else if (parm2 == 1) {
            Set temp = orchTree.keySet();
            Iterator iter = temp.iterator();
            Object a = null;
            int i = 0;
            while (iter.hasNext()) {
                a = iter.next();
                if (i == parm1) {
                    return a;
                }
                i++;
            }
            return null;
        } else if (parm2 == 2) {
            Collection temp = orchTree.values();
            Iterator iter = temp.iterator();
            Object a = null;
            int i = 0;
            while (iter.hasNext()) {
                a = iter.next();
                if (i == parm1) {
                    return ((Instrument) a).getName();
                }
                i++;
            }
            return null;
        } else {
            System.err.println("error in OrchestraTableModel");
            return null;
        }
    }

    @Override
    public int getRowCount() {
        if (orchTree == null) {
            return 0;
        }
        return orchTree.size();
    }

    @Override
    public boolean isCellEditable(int r, int c) {
        if (c == 0) {
            return true;
        }
        return false;
    }

    @Override
    public Class getColumnClass(int c) {
        return getValueAt(0, c).getClass();
    }

    @Override
    public void setValueAt(Object value, int row, int col) {
        if (orchTree == null) {
            return;
        }

        if (col == 0) {
            try {
                boolean val = ((Boolean) value).booleanValue();
                Collection temp = orchTree.values();
                Iterator iter = temp.iterator();
                Object a = null;
                int i = 0;
                while (iter.hasNext()) {
                    a = iter.next();
                    if (i == row) {
                        ((Instrument) a).setEnabled(val);
                    }
                    i++;
                }
            } catch (Exception e) {
                System.out.println("error in OrchestraTableModel: setValueAt");
                e.printStackTrace();
            }
        }
        fireTableCellUpdated(row, col);
    }

    /** *************** */
    /* CUSTOM METHODS */
    /** *************** */

    public void setOrchestra(Orchestra orch) {
        this.orch = orch;
        this.orchTree = orch.getOrchestra();
        fireTableDataChanged();
    }

    public void enableDisableAllInstruments() {
        if (orchTree == null) {
            return;
        }

        Iterator iter = this.orchTree.values().iterator();

        boolean enabled = true;
        Instrument temp;

        while (iter.hasNext()) {
            temp = (Instrument) iter.next();
            if (!temp.isEnabled()) {
                enabled = false;
                break;
            }
        }

        iter = this.orchTree.values().iterator();

        while (iter.hasNext()) {
            temp = (Instrument) iter.next();
            temp.setEnabled(!enabled);
        }
        this.fireTableRowsUpdated(0, this.getRowCount());

    }

    public int addInstrument(Instrument instrument, int currentInstrumentNum) {
        int newRowNum = orch.addInstrument(instrument, currentInstrumentNum);
        this.fireTableDataChanged();
        return newRowNum;
    }

    /**
     * @param instrumentNumber
     */
    public void removeInstrument(Integer instrumentNumber) {
        if (instrumentNumber == null) {
            return;
        }
        orch.removeInstrument(instrumentNumber);
        this.fireTableDataChanged();
    }

    /**
     * @param currentInstrumentNumber
     * @param iNum
     */
    public void changeInstrumentNumber(Integer currentInstrumentNumber,
            Integer newInstrumentNumber) {
        Object focusedInstrument = orchTree.remove(currentInstrumentNumber);
        orchTree.put(newInstrumentNumber, focusedInstrument);
        this.fireTableDataChanged();
    }

    /**
     * @param instruments
     */
    public ArrayList addInstruments(ArrayList instruments) {
        ArrayList instrumentNumbers = new ArrayList();

        for (Iterator iter = instruments.iterator(); iter.hasNext();) {
            Instrument instrument = (Instrument) iter.next();
            int iNum = orch.addInstrument(instrument);
            instrumentNumbers.add(new Integer(iNum));
        }
        this.fireTableDataChanged();
        return instrumentNumbers;
    }

    public void removeInstruments(ArrayList instrumentNumbers) {
        for (Iterator iter = instrumentNumbers.iterator(); iter.hasNext();) {
            Integer iNum = (Integer) iter.next();
            orch.removeInstrument(iNum);
        }
    }

}
