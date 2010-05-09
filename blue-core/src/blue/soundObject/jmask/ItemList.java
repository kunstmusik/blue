/*
 * blue - object composition environment for csound
 * Copyright (c) 2007 Steven Yi (stevenyi@gmail.com)
 *
 * Based on CMask by Andre Bartetzki
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
package blue.soundObject.jmask;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.builder.ToStringBuilder;

//import blue.soundObject.editor.jmask.ItemListEditor;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.lang.ref.WeakReference;

public class ItemList implements Generator, Serializable, TableModel,
        Accumulatable {

    public static final int CYCLE = 0;

    public static final int SWING = 1;

    public static final int RANDOM = 2;

    public static final int HEAP = 3;

    public static final String[] MODES = {"Cycle", "Swing", "Random", "Heap"};

    private int listType = CYCLE;

    private ArrayList listItems = new ArrayList();

    private transient int index = 0;

    private transient int direction = 0;

    private transient Vector<WeakReference<TableModelListener>> listeners = null;

    public static Generator loadFromXML(Element data) {
        ItemList retVal = new ItemList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("listType")) {
                retVal.setListType(Integer.parseInt(node.getTextString()));
            } else if (nodeName.equals("listItems")) {
                Elements items = node.getElements();

                while (items.hasMoreElements()) {
                    Element itemNode = items.next();
                    String itemNodeName = itemNode.getName();

                    if (itemNodeName.equals("item")) {
                        retVal.listItems.add(Double.valueOf(itemNode.
                                getTextString()));
                    }
                }

            } else if (nodeName.equals("index")) {
                retVal.index = Integer.parseInt(node.getTextString());
            } else if (nodeName.equals("direction")) {
                retVal.direction = Integer.parseInt(node.getTextString());
            }

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("generator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeInt("listType", getListType()));
        retVal.addElement(XMLUtilities.writeInt("index", index));
        retVal.addElement(XMLUtilities.writeInt("direction", direction));

        Element items = new Element("listItems");

        for (Iterator it = listItems.iterator(); it.hasNext();) {
            Double item = (Double) it.next();

            items.addElement("item").setText(item.toString());
        }

        retVal.addElement(items);

        return retVal;
    }

//    public JComponent getEditor() {
//        return new ItemListEditor(this);
//    }
    public void initialize(double duration) {
        index = 0;
        direction = 0;
    }

    public double getValue(double time) {
        double retVal = 0.0;

        if (listItems.size() <= 1) {
            retVal = ((Double) listItems.get(index)).doubleValue();
        } else {

            switch (this.getListType()) {
                case CYCLE:
                    retVal = ((Double) listItems.get(index)).doubleValue();
                    index++;

                    if (index >= listItems.size()) {
                        index = 0;
                    }

                    break;
                case SWING:
                    retVal = ((Double) listItems.get(index)).doubleValue();

                    if (direction == 0) {
                        index++;

                        if (index >= listItems.size()) {
                            index -= 2;
                            direction = 1;
                        }
                    } else {
                        index--;

                        if (index < 0) {
                            index = 1;
                            direction = 0;
                        }
                    }

                    break;
                case RANDOM:
                    index = (int) (Math.random() * listItems.size());
                    retVal = ((Double) listItems.get(index)).doubleValue();

                    break;
                case HEAP:
                    if (index == 0) {
                        Collections.shuffle(listItems);
                    }
                    retVal = ((Double) listItems.get(index)).doubleValue();
                    index++;

                    if (index >= listItems.size()) {
                        index = 0;
                    }

                    break;
                default:
                    break;
            }
        }

        return retVal;
    }

    public void addListItem(Double val, int rowIndex) {
        if (rowIndex < 0 || rowIndex >= listItems.size()) {
            listItems.add(val);
        } else {
            listItems.add(rowIndex, val);
        }

        TableModelEvent tme = new TableModelEvent(this);
        fireTableUpdated(tme);
    }

    public void removeListItem(int rowIndex) {
        listItems.remove(rowIndex);

        TableModelEvent tme = new TableModelEvent(this);
        fireTableUpdated(tme);
    }

    /* Table Model Code */
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector<WeakReference<TableModelListener>>();
        }

        for(WeakReference<TableModelListener> ref : listeners) {
            if(ref.get() == l) {
                return;
            }
        }

        listeners.add(new WeakReference<TableModelListener>(l));
        
    }

    public Class getColumnClass(int columnIndex) {
        return Double.class;
    }

    public int getColumnCount() {
        return 1;
    }

    public String getColumnName(int columnIndex) {
        return "List Items";
    }

    public int getRowCount() {
        return listItems.size();
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        return listItems.get(rowIndex);
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    public void removeTableModelListener(TableModelListener l) {
        if (listeners != null) {

            WeakReference<TableModelListener> found = null;

            for(WeakReference<TableModelListener> ref : listeners) {
                if(ref.get() == l) {
                    found = ref;
                    ref.clear();
                    break;
                }
            }

            if(found != null) {
                listeners.remove(found);
            }
        }
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if (aValue instanceof Double) {
            listItems.remove(rowIndex);
            listItems.add(rowIndex, aValue);
        }

        TableModelEvent tme = new TableModelEvent(this, rowIndex);

        fireTableUpdated(tme);
    }

    private void fireTableUpdated(TableModelEvent tme) {
        if (listeners != null) {

            for(WeakReference<TableModelListener> ref : listeners) {
                if(ref.get() != null) {
                    ref.get().tableChanged(tme);
                }
            }
        }
    }

    public void pushDown(int selectedIndex) {
        Object obj = listItems.remove(selectedIndex + 1);
        listItems.add(selectedIndex, obj);

        TableModelEvent tme = new TableModelEvent(this, selectedIndex,
                selectedIndex + 1);

        fireTableUpdated(tme);
    }

    public void pushUp(int selectedIndex) {
        Object obj = listItems.remove(selectedIndex);
        listItems.add(selectedIndex - 1, obj);

        TableModelEvent tme = new TableModelEvent(this, selectedIndex - 1,
                selectedIndex);

        fireTableUpdated(tme);
    }

    public int getListType() {
        return listType;
    }

    public void setListType(int listType) {
        this.listType = listType;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}
