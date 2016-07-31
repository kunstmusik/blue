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

package blue.udo;

import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

/**
 * @author Steven Yi
 */
public class OpcodeList extends ArrayList<UserDefinedOpcode> implements TableModel, Serializable {

    private static final MessageFormat fmt = new MessageFormat("uniqueUDO{0}");

    private transient int counter = 0;

    private transient Vector<TableModelListener> listeners;

    public void addOpcodes(UserDefinedOpcode[] udos) {
        for(UserDefinedOpcode udo : udos) {
            this.add(udo);
        }
        fireTableDataChanged();
    }
    
    public void addOpcode(UserDefinedOpcode udo) {
        this.add(udo);
        fireTableDataChanged();
    }

    public void addOpcode(int index, UserDefinedOpcode udo) {
        if (index < 0 || index >= this.size()) {
            this.add(udo);
        } else {
            this.add(index, udo);
        }

        fireTableDataChanged();
    }

    public UserDefinedOpcode getOpcode(int index) {
        if (index < 0 || index > (this.size() - 1)) {
            return null;
        }
        return this.get(index);
    }

    public void removeOpcode(int index) {
        this.remove(index);
        fireTableDataChanged();
    }
    
    public void removeOpcodes(int[] indexes) {
        for(int i = indexes.length - 1; i >= 0; i--) {
            this.remove(indexes[i]);
        }
        fireTableDataChanged();
    }

    public void pushUpUDO(int[] rows) {
        UserDefinedOpcode a = this.remove(rows[0] - 1);
        this.add(rows[rows.length - 1], a);
        this.fireTableDataChanged();
    }

    public void pushDownUDO(int[] rows) {
        UserDefinedOpcode a = this.remove(rows[rows.length - 1] + 1);
        this.add(rows[0], a);
        this.fireTableDataChanged();

    }

    /**
     * Checks if passed-in UDO already exists in OpcodeList (compared using
     * UserDefinedOpcode.isEquivalent(udo)) and if so, returns name of the
     * already existing UDO.
     */
    public String getNameOfEquivalentCopy(UserDefinedOpcode udo) {

        if (udo == null) {
            return null;
        }

        for (int i = 0; i < this.size(); i++) {
            UserDefinedOpcode temp = this.getOpcode(i);

            if (temp.isEquivalent(udo)) {
                return temp.getOpcodeName();
            }
        }

        return null;
    }

    /* Table Model Methods */

    @Override
    public int getColumnCount() {
        return 1;
    }

    @Override
    public int getRowCount() {
        return this.size();
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    @Override
    public Class getColumnClass(int columnIndex) {
        return String.class;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        UserDefinedOpcode udo = this.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return udo.getOpcodeName();
        }

        return null;
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if (columnIndex == 0) {
            String val = (String) aValue;

            getOpcode(rowIndex).setOpcodeName(val);

            fireTableDataChanged();
        }
    }

    @Override
    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            // case 0:
            // return "Enabled";
            case 0:
                return "Opcode Name";
                // case 2:
                // return "In Args";
        }
        return "";
    }

    /* TABLE MODEL METHODS */

    @Override
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector<>();
        }
        listeners.add(l);
    }

    @Override
    public void removeTableModelListener(TableModelListener l) {
        if (listeners == null) {
            return;
        }
        listeners.remove(l);
    }

    private void fireTableDataChanged() {
        if (listeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this);

        for (Iterator<TableModelListener> iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = iter.next();

            listener.tableChanged(tme);
        }
    }

    /* SAVE/LOAD METHODS */

    public static OpcodeList loadFromXML(Element data) {
        OpcodeList retVal = new OpcodeList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            UserDefinedOpcode udo = UserDefinedOpcode.loadFromXML(node);
            retVal.addOpcode(udo);

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("opcodeList");

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            UserDefinedOpcode udo = (UserDefinedOpcode) iter.next();
            retVal.addElement(udo.saveAsXML());
        }

        return retVal;
    }

    @Override
    public String toString() {
        StringBuilder buffer = new StringBuilder();

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            UserDefinedOpcode udo = (UserDefinedOpcode) iter.next();
            buffer.append(udo.generateCode()).append("\n");
        }

        return buffer.toString();
    }

    public boolean isNameUnique(String name) {
        for (Iterator iter = this.iterator(); iter.hasNext();) {
            UserDefinedOpcode udo = (UserDefinedOpcode) iter.next();
            if (udo.getOpcodeName().equals(name)) {
                return false;
            }
        }

        return true;
    }

    public String getUniqueName() {
        Object[] obj = new Object[] { new Integer(counter++) };

        String uniqueName = fmt.format(obj);

        while (!isNameUnique(uniqueName)) {
            obj[0] = new Integer(counter++);
            uniqueName = fmt.format(obj);
        }

        return uniqueName;
    }

    public static void main(String[] args) {
    }
}
