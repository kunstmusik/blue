/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.pianoRoll;

import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * @author steven
 */
public class PianoNote implements Comparable<PianoNote> {

    int octave = 8;

    int scaleDegree = 0;

    double start = 0.0f;

    double duration = 1.0f;

    String noteTemplate = "";

    List<Field> fields;

    private transient Set<PropertyChangeListener> listeners;

    public PianoNote() {
        fields = new ArrayList<>();
    }

    public PianoNote(PianoNote pn) {
        octave = pn.octave;
        scaleDegree = pn.scaleDegree;
        start = pn.start;
        duration = pn.duration;
        noteTemplate = pn.noteTemplate;

        fields = new ArrayList<>();
        for (var f : pn.fields) {
            fields.add(new Field(f));
        }
    }


    public double getDuration() {
        return duration;
    }

    public void setDuration(double duration) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "duration", this.duration, duration);
        this.duration = duration;
        firePropertyChange(pce);
    }

    public int getOctave() {
        return octave;
    }

    public void setOctave(int octave) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "octave", this.octave, octave);
        this.octave = octave;
        firePropertyChange(pce);
    }

    public int getScaleDegree() {
        return scaleDegree;
    }

    public void setScaleDegree(int scaleDegree) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "scaleDegree", this.scaleDegree, scaleDegree);
        this.scaleDegree = scaleDegree;
        firePropertyChange(pce);
    }

    public double getStart() {
        return start;
    }

    public void setStart(double start) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "start", this.start, start);
        this.start = start;
        firePropertyChange(pce);
    }

    public List<Field> getFields() {
        return fields;
    }


    /* PROPERTY CHANGE EVENTS */
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        checkListenersExists();
        this.listeners.add(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        checkListenersExists();
        this.listeners.remove(listener);
    }

    public void firePropertyChange(PropertyChangeEvent pce) {
        checkListenersExists();

        for (var listener : listeners) {
            listener.propertyChange(pce);
        }
    }

    private void checkListenersExists() {
        if (listeners == null) {
            listeners = new LinkedHashSet<>();
        }
    }

    /**
     * @return Returns the noteTemplate.
     */
    public String getNoteTemplate() {
        return noteTemplate;
    }

    /**
     * @param noteTemplate The noteTemplate to set.
     */
    public void setNoteTemplate(String noteTemplate) {
        this.noteTemplate = noteTemplate;
    }

    /* SERIALIZATION */
    public static PianoNote loadFromXML(Element data, Map<String, FieldDef> fieldTypes) {
        PianoNote note = new PianoNote();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "octave":
                    note.setOctave(Integer.parseInt(node.getTextString()));
                    break;
                case "scaleDegree":
                    note.setScaleDegree(Integer.parseInt(node.getTextString()));
                    break;
                case "start":
                    note.setStart(Double.parseDouble(node.getTextString()));
                    break;
                case "duration":
                    note.setDuration(Double.parseDouble(node.getTextString()));
                    break;
                case "noteTemplate":
                    note.setNoteTemplate(node.getTextString());
                    break;
                case "field":
                    note.fields.add(Field.loadFromXML(node, fieldTypes));
                    break;
            }
        }

        return note;
    }

    public Element saveAsXML() {
        Element retVal = new Element("pianoNote");

        retVal.addElement("octave").setText(Integer.toString(octave));
        retVal.addElement("scaleDegree").setText(Integer.toString(scaleDegree));

        retVal.addElement("start").setText(Double.toString(start));
        retVal.addElement("duration").setText(Double.toString(duration));

        retVal.addElement("noteTemplate").setText(noteTemplate);

        for (var f : fields) {
            retVal.addElement(f.saveAsXML());
        }

        return retVal;
    }

    @Override
    public int compareTo(PianoNote note2) {
        int val = this.octave - note2.octave;

        if (val != 0) {
            return val;
        }

        val = this.scaleDegree - note2.scaleDegree;

        if (val != 0) {
            return val;
        }

        double val2 = this.start - note2.start;

        if (val2 != 0) {
            if (val2 > 0) {
                return 1;
            }
            return -1;
        }

        val2 = this.duration - note2.duration;

        if (val2 != 0) {
            if (val2 > 0) {
                return 1;
            }
            return -1;
        }

        return 0;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public Optional<Field> getField(FieldDef fieldDef) {
        if (fieldDef == null) {
            return Optional.<Field>empty();
        }
        return fields.stream().filter(f -> f.getFieldDef() == fieldDef).findFirst();
    }
}
