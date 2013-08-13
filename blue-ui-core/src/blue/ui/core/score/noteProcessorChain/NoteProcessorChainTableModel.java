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

package blue.ui.core.score.noteProcessorChain;

import blue.BlueSystem;
import blue.noteProcessor.NoteProcessor;
import blue.noteProcessor.NoteProcessorChain;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.table.AbstractTableModel;

public class NoteProcessorChainTableModel extends AbstractTableModel {

    NoteProcessorChain npc;

    ArrayList props = new ArrayList();

    ArrayList npcProxies = new ArrayList();

    NoteProcessor currentNoteProcessor;

    public NoteProcessorChainTableModel() {

    }

    protected void setCurrentNoteProcessor(NoteProcessor np) {
        this.currentNoteProcessor = np;
    }

    public void setCurrentNoteProcessor(int row) {
        for (Iterator iter = npcProxies.iterator(); iter.hasNext();) {
            NoteProcessorEditProxy element = (NoteProcessorEditProxy) iter
                    .next();

            if (row >= element.getStartRow() && row <= element.getEndRow()) {
                currentNoteProcessor = element.getNoteProcessor();
                return;
            }
        }
        this.currentNoteProcessor = null;
    }

    public int[] getHilightRows() {
        if (this.currentNoteProcessor == null) {
            return null;
        }
        for (Iterator iter = npcProxies.iterator(); iter.hasNext();) {
            NoteProcessorEditProxy element = (NoteProcessorEditProxy) iter
                    .next();

            if (element.getNoteProcessor() == this.currentNoteProcessor) {
                return new int[] { element.getStartRow(), element.getEndRow() };
            }
        }
        return null;
    }

    public boolean isTitleRow(int row) {
        Object obj = props.get(row);
        return (obj instanceof NoteProcessorEditProxy);
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        this.npc = npc;
        props.clear();
        npcProxies.clear();
        currentNoteProcessor = null;

        if (npc == null) {
            this.fireTableDataChanged();
            return;
        }

        int startRow = 0;

        for (int i = 0; i < npc.size(); i++) {
            startRow += setupNoteProcessor(npc.getNoteProcessor(i), startRow);
        }
        this.fireTableDataChanged();
    }

    public int setupNoteProcessor(NoteProcessor np, int startRow) {

        Method[] m = np.getClass().getDeclaredMethods();

        ArrayList getMethods = new ArrayList();
        ArrayList setMethods = new ArrayList();

        for (int i = 0; i < m.length; i++) {
            if (m[i].getName().toLowerCase().startsWith("get")) {
                getMethods.add(m[i]);
            }
            if (m[i].getName().toLowerCase().startsWith("set")) {
                setMethods.add(m[i]);
            }
        }

        PropertyEditProxy proxy;
        String propName;

        int rowCount = 0;

        for (int i = 0; i < getMethods.size(); i++) {
            Method getTemp = (Method) getMethods.get(i);
            Method setTemp = findSetMethod(getTemp, setMethods);
            if (setTemp != null) {
                propName = setTemp.getName().substring(3);
                proxy = new PropertyEditProxy(np, propName, getTemp, setTemp);
                props.add(proxy);
                rowCount++;
            }
        }

        NoteProcessorEditProxy npeProxy = new NoteProcessorEditProxy(np,
                startRow, startRow + rowCount);
        props.add(startRow, npeProxy);
        npcProxies.add(npeProxy);

        return rowCount + 1;
    }

    private Method findSetMethod(Method getMethod, ArrayList a) {
        String name = getMethod.getName().substring(3).toLowerCase();
        for (int i = 0; i < a.size(); i++) {
            Method temp = (Method) a.get(i);
            if (temp.getName().toLowerCase().indexOf(name) > -1) {
                return temp;
            }
        }
        return null;
    }

    // METHODS FOR NOTEPROCESSORCHAIN

    public void addNoteProcessor(NoteProcessor np) {
        npc.addNoteProcessor(np);
        setNoteProcessorChain(npc);
    }

    public void removeNoteProcessor() {
        if (currentNoteProcessor == null) {
            return;
        }
        npc.remove(this.currentNoteProcessor);
        setNoteProcessorChain(npc);
    }

    public void pushUpNoteProcessor() {
        if (currentNoteProcessor == null) {
            return;
        }
        int index = npc.indexOf(currentNoteProcessor);

        if (index > 0) {
            Object a = npc.remove(index - 1);
            npc.add(index, a);
            NoteProcessor temp = currentNoteProcessor;
            setNoteProcessorChain(npc);
            setCurrentNoteProcessor(temp);
        }
    }

    public void pushDownNoteProcessor() {
        if (currentNoteProcessor == null) {
            return;
        }
        int index = npc.indexOf(currentNoteProcessor);

        if (index < npc.size() - 1) {
            Object a = npc.remove(index + 1);
            npc.add(index, a);
            NoteProcessor temp = currentNoteProcessor;
            setNoteProcessorChain(npc);
            setCurrentNoteProcessor(temp);
        }

    }

    // TABLE MODEL FUNCTIONS

    @Override
    public String getColumnName(int i) {
        if (i == 0) {
            return BlueSystem.getString("propertyEditor.property");
        }
        return BlueSystem.getString("propertyEditor.value");
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public Object getValueAt(int row, int column) {
        Object obj = props.get(row);

        if (obj instanceof NoteProcessorEditProxy) {
            if (column == 0) {
                return ((NoteProcessorEditProxy) obj).getName();
            }
            return "";

        }

        PropertyEditProxy temp = (PropertyEditProxy) obj;

        if (column == 0) {
            return temp.getPropertyName();
        }

        return temp.getValue();

        // return temp;

    }

    @Override
    public int getRowCount() {
        return props.size();
    }

    @Override
    public boolean isCellEditable(int r, int c) {
        Object obj = props.get(r);

        if (obj instanceof NoteProcessorEditProxy) {
            return false;
        }

        if (c == 1) {
            return true;
        }
        return false;
    }

    @Override
    public Class getColumnClass(int c) {
        if (c == 0) {
            return String.class;
        }
        return PropertyEditProxy.class;
    }

    @Override
    public void setValueAt(Object value, int row, int col) {
        if (col == 1) {
            try {
                PropertyEditProxy temp = (PropertyEditProxy) props.get(row);
                temp.setValue(value);
            } catch (Exception e) {
                // swallow exception: this just won't let the property be set,
                // and the table will be updated,
                // the old value
            }
        }
        fireTableCellUpdated(row, col);
    }

    public NoteProcessor getCurrentNoteProcessor() {
        return currentNoteProcessor;
    }
}