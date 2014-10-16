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

package blue.soundObject.tracker;

import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class TrackList implements Serializable, TableModel {

    private final ArrayList tracks = new ArrayList();

    private transient Vector listeners;

    private int steps = 64;

    private transient TableModelListener columnChangeListener;

    public TrackList() {
        columnChangeListener = new TableModelListener() {
            public void tableChanged(TableModelEvent e) {
                TableModelEvent tme = new TableModelEvent(TrackList.this,
                        TableModelEvent.HEADER_ROW);
                fireTableModelEvent(tme);
            }
        };
    }

    public void addTrack(Track track) {
        tracks.add(track);
        track.resizeSteps(steps);

        track.addTableModelListener(columnChangeListener);

        if (listeners != null) {
            TableModelEvent tme = new TableModelEvent(this,
                    TableModelEvent.HEADER_ROW);
            fireTableModelEvent(tme);
        }
    }

    public void addTrack(int index, Track track) {
        tracks.add(index, track);
        track.resizeSteps(steps);

        track.addTableModelListener(columnChangeListener);

        if (listeners != null) {
            TableModelEvent tme = new TableModelEvent(this,
                    TableModelEvent.HEADER_ROW);
            fireTableModelEvent(tme);
        }
    }

    public void removeTrack(int index) {
        removeTrack((Track) tracks.get(index));
    }

    public void removeTrack(Track track) {
        tracks.remove(track);
        track.removeAllPropertyChangeListeners();

        track.removeTableModelListener(columnChangeListener);

        if (listeners != null) {
            TableModelEvent tme = new TableModelEvent(this,
                    TableModelEvent.HEADER_ROW);
            fireTableModelEvent(tme);
        }
    }

    public void duplicateTrack(int index) {
        if (index >= tracks.size()) {
            return;
        }

        Track t = getTrack(index);
        Track temp = (Track) ObjectUtilities.clone(t);

        addTrack(index, temp);
    }

    public void clearTrack(int index) {
        if (index >= tracks.size()) {
            return;
        }

        Track t = getTrack(index);
        t.clearNotes();
    }

    public Track getTrack(int index) {
        return (Track) tracks.get(index);
    }

    public String getNextTrackName() {
        int maxVal = 0;

        for (Iterator it = tracks.iterator(); it.hasNext();) {
            Track track = (Track) it.next();
            String name = track.getName();

            if (name.startsWith("track")) {
                try {
                    int val = Integer.parseInt(name.substring(5));
                    if (val > maxVal) {
                        maxVal = val;
                    }
                } catch (NumberFormatException nfe) {

                }
            }
        }

        return "track" + (maxVal + 1);
    }

    public boolean contains(Track track) {
        for (Iterator it = tracks.iterator(); it.hasNext();) {
            if (track == it.next()) {
                return true;
            }
        }
        return false;
    }

    public int size() {
        return tracks.size();
    }

    public void fireRowChanged(int row) {
        fireTableModelEvent(new TableModelEvent(this, row, row));
    }

    private void fireTableModelEvent(TableModelEvent tme) {
        if (listeners != null) {
            for (Iterator iter = listeners.iterator(); iter.hasNext();) {
                TableModelListener listener = (TableModelListener) iter.next();
                listener.tableChanged(tme);
            }
        }
    }

    public NoteList generateNotes() throws NoteParseException {
        NoteList retVal = new NoteList();

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track tr = (Track) iter.next();

            retVal.merge(tr.generateNotes());

        }

        return retVal;
    }

    public int getSteps() {
        return steps;
    }

    public void setSteps(int steps) {
        this.steps = steps;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track tr = (Track) iter.next();
            tr.resizeSteps(steps);
        }
    }

    public Track getTrackForColumn(final int index) {
        int counter = index;

        Track retVal = null;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else {
                retVal = track;
                break;
            }
        }

        return retVal;
    }

    public Column getTrackColumn(final int index) {
        int counter = index;

        Column retVal = null;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else {
                if (counter == 0) {
                    break;
                } else {
                    retVal = track.getColumn(counter);
                    break;
                }
            }
        }

        return retVal;
    }

    // TABLE MODEL METHODS

    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

    public Class getColumnClass(int columnIndex) {
        return String.class;
    }

    public int getColumnCount() {
        int count = 0;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            count += track.getNumColumns();
        }

        return count;
    }

    public String getColumnName(int columnIndex) {
        Column c = getTrackColumn(columnIndex);

        return c == null ? "-" : c.getName();
    }

    public int getRowCount() {
        return steps;
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        int counter = columnIndex;

        String retVal = null;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else {
                TrackerNote note = track.getTrackerNote(rowIndex);
                retVal = note.getValue(counter);
                break;
            }
        }

        return retVal;
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        int counter = columnIndex;

        
        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else {
                if (counter == 0) {
                    return false;
                } else {
                    if(track.getTrackerNote(rowIndex).isOff()) {
                        return false;
                    }
                    return true;
                }
            }
        }
        return true;
    }

    public void removeTableModelListener(TableModelListener l) {
        if (listeners != null) {
            listeners.remove(l);
        }
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        int counter = columnIndex;

        String newVal = (String) aValue;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else {

                TrackerNote currentNote = track.getTrackerNote(rowIndex);

                if ("OFF".equals(newVal) && currentNote.isOff()) {
                    return;
                }

                if (!currentNote.isActive()) {

                    if (newVal == null || newVal.trim().length() == 0) {
                        return;
                    }

                    TrackerNote previousNote = null;

                    for (int i = rowIndex - 1; i >= 0; i--) {
                        TrackerNote temp = track.getTrackerNote(i);
                        if (temp.isActive()) {
                            previousNote = temp;
                            break;
                        }
                    }

                    if (previousNote != null) {
                        currentNote.copyValues(previousNote);
                    } else {
                        for (int i = 0; i < track.getRowCount(); i++) {
                            Column c = track.getColumn(i + 1);
                            currentNote.setValue(i + 1, c.getDefaultValue());
                        }
                    }
                }

                currentNote.setValue(counter, newVal);
                return;
            }
        }

        fireRowChanged(rowIndex);
    }

    public int getTrackIndexForColumn(int column) {
        int counter = column;
        int index = 0;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
                index++;
            } else {
                break;
            }
        }
        return index;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public Element saveAsXML() {
        Element retVal = new Element("trackList");

        retVal.addElement(XMLUtilities.writeInt("steps", steps));

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track tr = (Track) iter.next();
            retVal.addElement(tr.saveAsXML());
        }

        return retVal;
    }

    public static TrackList loadFromXML(Element data) {
        TrackList trackList = new TrackList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("steps")) {
                trackList.setSteps(XMLUtilities.readInt(node));
            } else if (nodeName.equals("track")) {
                trackList.addTrack(Track.loadFromXML(node));
            }
        }

        return trackList;
    }

    public int getIndexOfTrack(Track t) {
        return tracks.indexOf(t);
    }

    /* HANDLE SERIALIZATION */

    private void writeObject(java.io.ObjectOutputStream out) throws IOException {
        out.defaultWriteObject();
    }

    private void readObject(java.io.ObjectInputStream in) throws IOException,
            ClassNotFoundException {

        in.defaultReadObject();

        columnChangeListener = new TableModelListener() {
            public void tableChanged(TableModelEvent e) {
                TableModelEvent tme = new TableModelEvent(TrackList.this,
                        TableModelEvent.HEADER_ROW);
                fireTableModelEvent(tme);
            }
        };

        for (Iterator it = tracks.iterator(); it.hasNext();) {
            Track t = (Track) it.next();
            t.addTableModelListener(columnChangeListener);
        }
    }
}
