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

import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

import electric.xml.Element;
import electric.xml.Elements;

public class MarkersList implements Serializable, TableModel,
        PropertyChangeListener {

    ArrayList markers = new ArrayList();

    private transient Vector listeners = null;

    private transient Vector listListeners = null;

    public void addMarker(float time) {
        String name = "Marker" + (markers.size() + 1);

        Marker m = new Marker();
        m.setTime(time);
        m.setName(name);

        addMarker(m);
    }

    public void addMarker(Marker marker) {
        markers.add(marker);
        marker.addPropertyChangeListener(this);

        Collections.sort(markers);

        int index = markers.indexOf(marker);

        if (listeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this, index, index,
                TableModelEvent.ALL_COLUMNS, TableModelEvent.INSERT);

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();
            listener.tableChanged(tme);
        }

        fireTableDataChanged();
    }

    public Marker getMarker(int index) {
        return (Marker) markers.get(index);
    }

    public void removeMarker(Marker marker) {
        removeMarker(markers.indexOf(marker));
    }

    public void removeMarker(int index) {
        Marker m = (Marker) markers.remove(index);
        m.removePropertyChangeListener(this);

        if (listeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this, index, index,
                TableModelEvent.ALL_COLUMNS, TableModelEvent.DELETE);

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();
            listener.tableChanged(tme);
        }
    }

    public int size() {
        return markers.size();
    }

    // TABLE MODEL CLASSES
    public int getRowCount() {
        return size();
    }

    public int getColumnCount() {
        return 2;
    }

    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return "Time";
            case 1:
                return "Label";
        }
        return null;
    }

    public Class getColumnClass(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return Float.class;
            case 1:
                return String.class;
        }
        return null;
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        Marker m = getMarker(rowIndex);

        if (m == null) {
            return null;
        }

        switch (columnIndex) {
            case 0:
                return new Float(m.getTime());
            case 1:
                return m.getName();
        }

        return null;
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        Marker m = getMarker(rowIndex);

        if (m == null) {
            return;
        }

        switch (columnIndex) {
            case 0:
                Float f = (Float) aValue;
                m.setTime(f.floatValue());

                break;
            case 1:
                String title = (String) aValue;

                if (title.trim().length() > 0) {
                    m.setName(title);
                }

                break;
        }

        fireTableDataChanged();

    }

    public static MarkersList loadFromXML(Element data) {
        MarkersList markers = new MarkersList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Marker m = Marker.loadFromXML(nodes.next());
            markers.addMarker(m);
        }

        return markers;
    }

    public Element saveAsXML() {
        Element retVal = new Element("markersList");

        for (int i = 0; i < size(); i++) {
            Marker m = getMarker(i);
            retVal.addElement(m.saveAsXML());
        }

        return retVal;
    }

    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

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

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();
            listener.tableChanged(tme);
        }
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (markers.contains(evt.getSource())) {
            if (evt.getPropertyName().equals("time")) {
                Collections.sort(markers);
                fireTableDataChanged();
            }
        }

    }
}
