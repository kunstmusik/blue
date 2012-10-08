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
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * @author steven
 */
public class PianoNote implements Serializable, Cloneable, Comparable<PianoNote> {
    int octave = 8;

    int scaleDegree = 0;

    float start = 0.0f;

    float duration = 1.0f;

    String noteTemplate = "";

    private transient ArrayList listeners;

    // public Note generateNote(final String noteTemplate) {
    // String template = noteTemplate;
    //
    // return Note.createNote(template);
    // }

    public float getDuration() {
        return duration;
    }

    public void setDuration(float duration) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "duration",
                new Float(this.duration), new Float(duration));
        this.duration = duration;
        firePropertyChange(pce);
    }

    public int getOctave() {
        return octave;
    }

    public void setOctave(int octave) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "octave",
                new Integer(this.octave), new Integer(octave));
        this.octave = octave;
        firePropertyChange(pce);
    }

    public int getScaleDegree() {
        return scaleDegree;
    }

    public void setScaleDegree(int scaleDegree) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "scaleDegree",
                new Integer(this.scaleDegree), new Integer(scaleDegree));
        this.scaleDegree = scaleDegree;
        firePropertyChange(pce);
    }

    public float getStart() {
        return start;
    }

    public void setStart(float start) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "start",
                new Float(this.start), new Float(start));
        this.start = start;
        firePropertyChange(pce);
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

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();
            listener.propertyChange(pce);
        }
    }

    private void checkListenersExists() {
        if (listeners == null) {
            listeners = new ArrayList();
        }
    }

    /**
     * @return Returns the noteTemplate.
     */
    public String getNoteTemplate() {
        return noteTemplate;
    }

    /**
     * @param noteTemplate
     *            The noteTemplate to set.
     */
    public void setNoteTemplate(String noteTemplate) {
        this.noteTemplate = noteTemplate;
    }

    /* SERIALIZATION */

    public static PianoNote loadFromXML(Element data) {
        PianoNote note = new PianoNote();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            if (node.getName().equals("octave")) {
                note.setOctave(Integer.parseInt(node.getTextString()));
            } else if (node.getName().equals("scaleDegree")) {
                note.setScaleDegree(Integer.parseInt(node.getTextString()));
            } else if (node.getName().equals("start")) {
                note.setStart(Float.parseFloat(node.getTextString()));
            } else if (node.getName().equals("duration")) {
                note.setDuration(Float.parseFloat(node.getTextString()));
            } else if (node.getName().equals("noteTemplate")) {
                note.setNoteTemplate(node.getTextString());
            }
        }

        return note;
    }

    public Element saveAsXML() {
        Element retVal = new Element("pianoNote");

        retVal.addElement("octave").setText(Integer.toString(octave));
        retVal.addElement("scaleDegree").setText(Integer.toString(scaleDegree));

        retVal.addElement("start").setText(Float.toString(start));
        retVal.addElement("duration").setText(Float.toString(duration));

        retVal.addElement("noteTemplate").setText(noteTemplate);

        return retVal;
    }

    public Object clone() {
        PianoNote note = new PianoNote();

        note.octave = this.octave;
        note.scaleDegree = this.scaleDegree;
        note.start = this.start;
        note.duration = this.duration;
        note.noteTemplate = this.noteTemplate;

        return note;
    }

    public int compareTo(PianoNote note2) {
        int val = this.octave - note2.octave;
        
        if(val != 0) {
            return val;
        }
        
        val = this.scaleDegree - note2.scaleDegree;
        
        if(val != 0) {
            return val;
        }
        
        float val2 = this.start - note2.start;
        
        if(val2 != 0) {
            if(val2 > 0) {
                return 1;
            }
            return -1;
        }
        
        val2 = this.duration - note2.duration;
        
        if(val2 != 0) {
            if(val2 > 0) {
                return 1;
            }
            return -1;
        }
        
        return 0;
    }
    
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}