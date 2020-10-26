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
package blue.soundObject.tracker;

import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class TrackList implements TableModel {

    private final ArrayList<Track> tracks = new ArrayList<>();

    private transient Vector listeners;

    private int steps = 64;

    private final transient TableModelListener columnChangeListener
            = e -> {
                TableModelEvent tme = new TableModelEvent(TrackList.this,
                        TableModelEvent.HEADER_ROW);
                fireTableModelEvent(tme);
            };

    public TrackList() {
    }

    public TrackList(TrackList tl) {
        steps = tl.steps;
        for (Track track : tl.tracks) {
            addTrack(new Track(track));
        }
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
        removeTrack(tracks.get(index));
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
        Track temp = new Track(t);

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
        return tracks.get(index);
    }

    public String getNextTrackName() {
        int maxVal = 0;

        for (Track track : tracks) {
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
        return tracks.contains(track);
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

    public NoteList generateNotes(int stepsPerBeat) throws NoteParseException {
        NoteList retVal = new NoteList();

        for (Track tr : tracks) {
            retVal.merge(tr.generateNotes(stepsPerBeat));
        }

        return retVal;
    }

    public int getSteps() {
        return steps;
    }

    public void setSteps(int steps) {
        this.steps = steps;

        for (Track tr : tracks) {
            tr.resizeSteps(steps);
        }
    }

    public Track getTrackForColumn(final int index) {
        int counter = index;

        Track retVal = null;

        for (Track track : tracks) {
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

        for (Track track : tracks) {
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else if (counter == 0) {
                break;
            } else {
                retVal = track.getColumn(counter);
                break;
            }
        }

        return retVal;
    }

    // TABLE MODEL METHODS
    @Override
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

    @Override
    public Class getColumnClass(int columnIndex) {
        return String.class;
    }

    @Override
    public int getColumnCount() {
        int count = 0;

        for (Iterator iter = tracks.iterator(); iter.hasNext();) {
            Track track = (Track) iter.next();
            count += track.getNumColumns();
        }

        return count;
    }

    @Override
    public String getColumnName(int columnIndex) {
        Column c = getTrackColumn(columnIndex);

        return c == null ? "-" : c.getName();
    }

    @Override
    public int getRowCount() {
        return steps;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        int counter = columnIndex;

        String retVal = null;

        for (Track track : tracks) {
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

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        int counter = columnIndex;

        for (Track track : tracks) {
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
            } else if (counter == 0) {
                return false;
            } else {
                return !track.getTrackerNote(rowIndex).isOff();
            }
        }
        return true;
    }

    @Override
    public void removeTableModelListener(TableModelListener l) {
        if (listeners != null) {
            listeners.remove(l);
        }
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        int counter = columnIndex;

        String newVal = (String) aValue;

        for (Track track : tracks) {
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

        for (Track track : tracks) {
            if (counter >= track.getNumColumns()) {
                counter -= track.getNumColumns();
                index++;
            } else {
                break;
            }
        }
        return index;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public Element saveAsXML() {
        Element retVal = new Element("trackList");

        retVal.addElement(XMLUtilities.writeInt("steps", steps));

        for (Track tr : tracks) {
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
            switch (nodeName) {
                case "steps":
                    trackList.setSteps(XMLUtilities.readInt(node));
                    break;
                case "track":
                    trackList.addTrack(Track.loadFromXML(node));
                    break;
            }
        }

        return trackList;
    }

    public int getIndexOfTrack(Track t) {
        return tracks.indexOf(t);
    }
}
