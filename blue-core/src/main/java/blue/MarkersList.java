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

import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

public class MarkersList implements TableModel, PropertyChangeListener {

    ArrayList<Marker> markers = new ArrayList<>();

    private transient Vector listeners = null;

    public MarkersList() {
    }

    public MarkersList(MarkersList markersList) {
        for (Marker marker : markersList.markers) {
            markers.add(new Marker(marker));
        }
    }
    
    public boolean contains(Marker m) {
        return markers.contains(m);
    }

    public void addMarker(double time) {
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
        return markers.get(index);
    }

    public void removeMarker(Marker marker) {
        removeMarker(markers.indexOf(marker));
    }

    public void removeMarker(int index) {
        Marker m = markers.remove(index);
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
    @Override
    public int getRowCount() {
        return size();
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return "Time";
            case 1:
                return "Label";
        }
        return null;
    }

    @Override
    public Class getColumnClass(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return Double.class;
            case 1:
                return String.class;
        }
        return null;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        Marker m = getMarker(rowIndex);

        if (m == null) {
            return null;
        }

        switch (columnIndex) {
            case 0:
                return new Double(m.getTime());
            case 1:
                return m.getName();
        }

        return null;
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        Marker m = getMarker(rowIndex);

        if (m == null) {
            return;
        }

        switch (columnIndex) {
            case 0:
                Double f = (Double) aValue;
                m.setTime(f.doubleValue());

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

    @Override
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector();
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

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();
            listener.tableChanged(tme);
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (markers.contains(evt.getSource())) {
            if (evt.getPropertyName().equals("time")) {
                Collections.sort(markers);
                fireTableDataChanged();
            }
        }

    }
}
