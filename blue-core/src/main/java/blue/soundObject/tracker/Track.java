/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import org.apache.commons.lang3.builder.EqualsBuilder;

public class Track implements TableModel {

    private static final MessageFormat COL_NAME = new MessageFormat("<{0}>");

    public static final String NAME = "name";

    private String name = "track";

    private String noteTemplate = "i <INSTR_ID> <START> <DUR> <pch> <db>";

    private String instrumentId = "1";

    ArrayList<Column> columns = new ArrayList<>();

    ArrayList<TrackerNote> trackerNotes = new ArrayList<>();

    private transient Vector listeners = null;

    private transient Vector tableListeners = null;

    public Track() {
        this(true);
    }

    private Track(boolean init) {
        if (init) {
            addColumn(new Column.PitchColumn());
            addColumn(new Column.AmpColumn());
        }
    }

    public Track(Track track) {
       name = track.name;
       noteTemplate = track.noteTemplate;
       instrumentId = track.instrumentId;
       for(Column col : track.columns) {
            addColumn(new Column(col));
       }
       for(TrackerNote n :track.trackerNotes) {
            trackerNotes.add(new TrackerNote(n));
       }
    }

    public void resizeSteps(int steps) {
        if (steps < trackerNotes.size()) {
            for (int i = trackerNotes.size() - 1; i >= steps; i--) {
                trackerNotes.remove(i);
            }
        } else {
            int numToAdd = steps - trackerNotes.size();
            for (int i = 0; i < numToAdd; i++) {
                trackerNotes.add(createNewNote());
            }
        }
    }

    private TrackerNote createNewNote() {
        // FIXME - needs to create a row and initialize according to columns
        TrackerNote note = new TrackerNote();
        for (int i = 0; i < columns.size(); i++) {
            note.addColumn();
        }
        return note;
    }

    public Column getColumn(int index) {
        Column retVal = null;

        switch (index) {
            case 0:
                retVal = null;
            default:
                retVal = columns.get(index - 1);
        }

        return retVal;
    }

    /**
     * MUST BE CAREFUL - This is used by TracksEditor to get the number of
     * Column objects, while getColumnCount is used by TrackEditor to get the
     * number cols(fields) to use to modify the columns
     */
    public int getNumColumns() {
        return 1 + columns.size();
    }

    /**
     * Get number of steps in the track (should match parent TrackerObject's
     * step size)
     * 
     * @return
     */
    public int getNumSteps() {
        return trackerNotes.size();
    }

    public TrackerNote getTrackerNote(int rowIndex) {
        return trackerNotes.get(rowIndex);
    }

    public void setName(String name) {
        String oldName = this.name;
        this.name = name;

        firePropertyChange(NAME, oldName, this.name);
    }

    public String getName() {
        return name;
    }

    public String getNoteTemplate() {
        return noteTemplate;
    }

    public void setNoteTemplate(String noteTemplate) {
        this.noteTemplate = noteTemplate;
    }

    public String getInstrumentId() {
        return instrumentId;
    }

    public void setInstrumentId(String instrumentId) {
        this.instrumentId = instrumentId;
    }

    public void pushUpColumn(int index) {
        if (index < 1 || index >= columns.size()) {
            return;
        }

        Column obj = columns.remove(index - 1);
        columns.add(index, obj);

        for (TrackerNote trNote : trackerNotes) {
            String val1 = trNote.getValue(index);
            String val2 = trNote.getValue(index + 1);

            trNote.setValue(index, val2);
            trNote.setValue(index + 1, val1);
        }

        fireTableDataChanged();
    }

    public void pushDownColumn(int index) {
        if (index < 0 || index > columns.size() - 2) {
            return;
        }

        Column obj = columns.remove(index + 1);
        columns.add(index, obj);

        for (TrackerNote trNote : trackerNotes) {
            String val1 = trNote.getValue(index + 1);
            String val2 = trNote.getValue(index + 2);

            trNote.setValue(index + 1, val2);
            trNote.setValue(index + 2, val1);
        }

        fireTableDataChanged();
    }

    public void addColumn(Column col) {
        columns.add(col);

        for (TrackerNote trNote : trackerNotes) {
            trNote.addColumn();
        }

        fireTableDataChanged();
    }

    public void removeColumn(Column col) {
        int index = columns.indexOf(col);

        if (index < 0) {
            return;
        }

        if (columns.contains(col)) {

            for (Iterator iter = trackerNotes.iterator(); iter.hasNext();) {
                TrackerNote trNote = (TrackerNote) iter.next();
                trNote.removeColumn(index);
            }

            columns.remove(col);

            fireTableDataChanged();
        }
    }

    public NoteList generateNotes() throws NoteParseException {
        NoteList retVal = new NoteList();

        String instrId = getInstrumentId();

        try {
            Double.parseDouble(instrId);
        } catch (NumberFormatException nfe) {
            instrId = "\"" + instrId + "\"";
        }

        String noteTemplate = TextUtilities.replaceAll(getNoteTemplate(),
                "<INSTR_ID>", instrId);
        noteTemplate = TextUtilities.replaceAll(noteTemplate, "<INSTR_NAME>",
                getInstrumentId());

        for (int i = 0; i < trackerNotes.size(); i++) {
            TrackerNote trNote = trackerNotes.get(i);

            if (trNote.isActive() && !trNote.isOff()) {

                String noteStr = noteTemplate;

                int dur = 1;

                for (int j = i + 1; j < trackerNotes.size(); j++) {
                    TrackerNote temp = trackerNotes.get(j);
                    if (temp.isActive() || temp.isOff()) {
                        break;
                    }
                    dur++;
                }

                String durStr = trNote.isTied() ? "-" + dur : Integer
                        .toString(dur);

                noteStr = TextUtilities.replaceAll(noteStr, "<START>", Integer
                        .toString(i));
                noteStr = TextUtilities.replaceAll(noteStr, "<DUR>", durStr);

                Object[] colNameArg = new Object[1];

                for (int j = 1; j < getNumColumns(); j++) {
                    Column col = getColumn(j);
                    colNameArg[0] = col.getName();
                    String colNameStr = COL_NAME.format(colNameArg);

                    String newValue = trNote.getValue(j);

                    if (col.getType() == Column.TYPE_BLUE_PCH
                            && col.isOutputFrequency()) {

                        String[] parts = newValue.split("\\.");
                        int octave = Integer.parseInt(parts[0]);
                        int scaleDegree = Integer.parseInt(parts[1]);

                        double freq = col.getScale().getFrequency(octave,
                                scaleDegree);

                        newValue = Double.toString(freq);
                    }

                    noteStr = TextUtilities.replaceAll(noteStr, colNameStr,
                            newValue);
                }

                Note note = Note.createNote(noteStr);

                retVal.add(note);

            }

        }

        return retVal;
    }

    /* PROPERTY LISTENER CODE */

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    public void removeAllPropertyChangeListeners() {
        listeners.clear();
    }

    /* PROPERTY CHANGE SUPPORT */

    public void firePropertyChange(String propertyName, double oldVal,
            double newVal) {
        firePropertyChange(propertyName, new Double(oldVal), new Double(newVal));
    }

    public void firePropertyChange(String propertyName, boolean oldVal,
            boolean newVal) {
        firePropertyChange(propertyName, Boolean.valueOf(oldVal), Boolean
                .valueOf(newVal));
    }

    public void firePropertyChange(String propertyName, Object oldVal,
            Object newVal) {
        if (listeners == null || listeners.size() == 0) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this, propertyName,
                oldVal, newVal);

        for (Iterator it = listeners.iterator(); it.hasNext();) {
            PropertyChangeListener pcl = (PropertyChangeListener) it.next();

            pcl.propertyChange(pce);

        }
    }

    /* TABLE MODEL METHODS */

    @Override
    public int getRowCount() {
        return columns.size();
    }

    @Override
    public String getColumnName(int columnIndex) {
        if (columnIndex == 0) {
            return "Name";
        }
        return "Type";
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public Class getColumnClass(int columnIndex) {
        return String.class;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return columnIndex == 0;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        Column col = columns.get(rowIndex);

        if (columnIndex == 0) {
            return col.getName();
        }

        return Column.TYPES[col.getType()];
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        if (columnIndex != 0) {
            return;
        }

        Column col = columns.get(rowIndex);

        if (!col.getName().equals(aValue)) {
            col.setName((String) aValue);
            fireTableDataChanged();
        }
    }

    /* TABLE MODEL METHODS */

    @Override
    public void addTableModelListener(TableModelListener l) {
        if (tableListeners == null) {
            tableListeners = new Vector();
        }
        tableListeners.add(l);
    }

    @Override
    public void removeTableModelListener(TableModelListener l) {
        if (tableListeners == null) {
            return;
        }
        tableListeners.remove(l);
    }

    private void fireTableDataChanged() {
        if (tableListeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this);

        for (Iterator iter = tableListeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();

            listener.tableChanged(tme);
        }
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    /* SERIALIZATION METHODS */

    public Element saveAsXML() {
        Element retVal = new Element("track");

        retVal.addElement("name").setText(name);
        retVal.addElement("noteTemplate").setText(noteTemplate);
        retVal.addElement("instrumentId").setText(instrumentId);

        Element colElement = new Element("columns");

        retVal.addElement(colElement);

        for (Iterator iter = columns.iterator(); iter.hasNext();) {
            Column col = (Column) iter.next();
            colElement.addElement(col.saveAsXML());
        }

        Element trNotesElement = new Element("trackerNotes");

        retVal.addElement(trNotesElement);

        for (TrackerNote note : trackerNotes) {
            trNotesElement.addElement(note.saveAsXML());
        }

        return retVal;
    }

    public static Track loadFromXML(Element data) {
        Track retVal = new Track(false);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "name":
                    retVal.name = node.getTextString();
                    if (retVal.name == null) {
                        retVal.name = "";
                    }
                    break;
                case "noteTemplate":
                    retVal.noteTemplate = node.getTextString();
                    if (retVal.noteTemplate == null) {
                        retVal.noteTemplate = "";
                    }
                    break;
                case "instrumentId":
                    retVal.instrumentId = node.getTextString();
                    if (retVal.instrumentId == null) {
                        retVal.instrumentId = "";
                    }
                    break;
                case "columns":
                    {
                        Elements nodes2 = node.getElements();
                        while (nodes2.hasMoreElements()) {
                            retVal.addColumn(Column.loadFromXML(nodes2.next()));
                        }
                        break;
                    }
                case "trackerNotes":
                    {
                        Elements nodes2 = node.getElements();
                        while (nodes2.hasMoreElements()) {
                            retVal.trackerNotes.add(TrackerNote.loadFromXML(nodes2
                                    .next()));
                        }
                        break;
                    }
            }
        }

        return retVal;
    }

    public void clearNotes() {
        for (TrackerNote note : trackerNotes) {
            note.clear();
        }

        fireTableDataChanged();
    }

    public void insertNote(int start) {
        trackerNotes.add(start, createNewNote());
        trackerNotes.remove(trackerNotes.size() - 1);
    }

    public void removeNote(int start) {
        trackerNotes.remove(start);
        trackerNotes.add(createNewNote());

    }
}
