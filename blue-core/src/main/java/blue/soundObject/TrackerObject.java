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

package blue.soundObject;

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.tracker.TrackList;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Iterator;
import java.util.Map;
import java.util.Vector;

@SoundObjectPlugin(displayName = "TrackerObject", live=true, position = 140)
public class TrackerObject extends AbstractSoundObject {

    private TrackList tracks = new TrackList();

    private TimeBehavior timeBehavior = TimeBehavior.REPEAT;

    double repeatPoint = 16.0f;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private transient Vector listeners = null;
    
    int stepsPerBeat = 4;

    public TrackerObject() {
        this.setName("Tracker");
    }

    public TrackerObject(TrackerObject to) {
        super(to);
        tracks = new TrackList(to.tracks);
        stepsPerBeat = to.stepsPerBeat;
        timeBehavior = to.timeBehavior;
        repeatPoint = to.repeatPoint;
        npc = new NoteProcessorChain(to.npc);
    }

    public NoteList generateNotes(double renderStart, double renderEnd) throws SoundObjectException {
        NoteList nl;

        try {
            nl = tracks.generateNotes(stepsPerBeat);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }
        try {
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint(), getSteps());

        ScoreUtilities.setScoreStart(nl, startTime);

        return nl;
    }

    @Override
    public double getObjectiveDuration() {
        
        // FIXME: May need to recalculate this in the future...
        return subjectiveDuration;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public TimeBehavior getTimeBehavior() {
        return timeBehavior;
    }

    @Override
    public void setTimeBehavior(TimeBehavior timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public double getRepeatPoint() {
        return repeatPoint;
    }

    @Override
    public void setRepeatPoint(double repeatPoint) {
        this.repeatPoint = repeatPoint;
    }

    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement(XMLUtilities.writeInt("stepsPerBeat", stepsPerBeat));
        retVal.addElement(tracks.saveAsXML());

        return retVal;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        TrackerObject retVal = new TrackerObject();

        SoundObjectUtilities.initBasicFromXML(data, retVal);

        // For legacy projects prior to 2.8.1, default to 1 step 
        int stepsPerBeat = 1; 
        
        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "stepsPerBeat":
                    stepsPerBeat = XMLUtilities.readInt(node);
                    break;
                case "trackList":
                    retVal.setTracks(TrackList.loadFromXML(node));
                    break;
            }
        }
        retVal.stepsPerBeat = stepsPerBeat;

        return retVal;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    public int getSteps() {
        return tracks.getSteps();
    }

    public void setSteps(int steps) {
        int oldSteps = tracks.getSteps();

        tracks.setSteps(steps);

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "steps",
                new Integer(oldSteps), new Integer(steps));

        firePropertyChangeEvent(pce);
    }

    public TrackList getTracks() {
        return tracks;
    }

    public void setTracks(TrackList tracks) {
        this.tracks = tracks;
    }

    public int getStepsPerBeat() {
        return stepsPerBeat;
    }

    public void setStepsPerBeat(int stepsPerBeat) {
        this.stepsPerBeat = stepsPerBeat;
    }
    
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

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

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime, double endTime) 
            throws SoundObjectException {
        return generateNotes(startTime, endTime);
    }

    @Override
    public TrackerObject deepCopy() {
        return new TrackerObject(this);
    }

}
