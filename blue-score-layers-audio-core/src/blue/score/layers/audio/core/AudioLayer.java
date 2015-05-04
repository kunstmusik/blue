/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.score.layers.audio.core;

import blue.CompileData;
import blue.mixer.Channel;
import blue.mixer.Mixer;
import blue.orchestra.GenericInstrument;
import blue.score.ScoreObject;
import static blue.score.layers.Layer.LAYER_HEIGHT;
import blue.score.layers.ScoreObjectLayer;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObjectException;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.rmi.dgc.VMID;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import java.util.Vector;

/**
 *
 * @author stevenyi
 *
 */
public class AudioLayer extends ArrayList<AudioClip> implements ScoreObjectLayer<AudioClip> {

    private String name = "";
    private boolean muted = false;
    private boolean solo = false;

    private int heightIndex = 0;

    public static int HEIGHT_MAX_INDEX = 9;

    private transient Vector<PropertyChangeListener> propListeners = null;
    private transient Vector<AudioLayerListener> layerListeners = null;
    private String uniqueId;

    private static MessageFormat INSTR_TEXT = null;

    public AudioLayer() {
        this.uniqueId = new VMID().toString();
    }

    @Override
    public boolean add(AudioClip e) {
        boolean retVal = super.add(e);
        fireAudioClipAdded(e);
        return retVal;
    }

    @Override
    public boolean remove(ScoreObject o) {
        if (!(o instanceof AudioClip)) {
            return false;
        }
        boolean retVal = super.remove(o);
        if (retVal) {
            fireAudioClipRemoved((AudioClip) o);
        }
        return retVal;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        String oldName = this.name;
        this.name = (name == null) ? "" : name;

        if (!this.name.equals(oldName)) {
            firePropertyChangeEvent(new PropertyChangeEvent(this, "name",
                    oldName, name));
        }
    }

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        this.muted = muted;
    }

    public boolean isSolo() {
        return solo;
    }

    public void setSolo(boolean solo) {
        this.solo = solo;
    }

    public int getHeightIndex() {
        return heightIndex;
    }

    public void setHeightIndex(int heightIndex) {
        if (this.heightIndex == heightIndex) {
            return;
        }

        int oldHeight = this.heightIndex;
        this.heightIndex = heightIndex;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "heightIndex",
                new Integer(oldHeight), new Integer(heightIndex));

        firePropertyChangeEvent(pce);
    }

    public int getAudioLayerHeight() {
        return (heightIndex + 1) * LAYER_HEIGHT;
    }

    public String getUniqueId() {
        return uniqueId;
    }

    public Element saveAsXML() {
        Element retVal = new Element("audioLayer");

        retVal.setAttribute("name", getName());
        retVal.setAttribute("muted", Boolean.toString(isMuted()));
        retVal.setAttribute("solo", Boolean.toString(isSolo()));
        retVal.setAttribute("heightIndex", Integer.toString(this
                .getHeightIndex()));
        retVal.setAttribute("uniqueId", uniqueId);

        for (AudioClip clip : this) {
            retVal.addElement(clip.saveAsXML());
        }

        return retVal;
    }

    public static AudioLayer loadFromXML(Element data) {
        AudioLayer layer = new AudioLayer();

        layer.setName(data.getAttributeValue("name"));
        layer.setMuted(
                Boolean.valueOf(data.getAttributeValue("muted")).booleanValue());
        layer.setSolo(
                Boolean.valueOf(data.getAttributeValue("solo")).booleanValue());

        if (data.getAttribute("uniqueId") != null) {
            layer.uniqueId = data.getAttributeValue("uniqueId");
        }

        String heightIndexStr = data.getAttributeValue("heightIndex");
        if (heightIndexStr != null) {
            layer.setHeightIndex(Integer.parseInt(heightIndexStr));
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            layer.add(AudioClip.loadFromXML(nodes.next()));
        }

        return layer;
    }

    void clearListeners() {
        if (propListeners != null) {
            propListeners.clear();
            propListeners = null;
        }

        if (layerListeners != null) {
            layerListeners.clear();
            layerListeners = null;
        }
    }

    protected String getInstrumentText(String var1, String var2) {
        if (INSTR_TEXT == null) {
            StringBuilder str = new StringBuilder();
            try {
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(
                                this.getClass().getClassLoader().getResourceAsStream(
                                        "blue/score/layers/audio/core/playback_instrument.orc")))) {
                                    String line;
                                    while ((line = br.readLine()) != null) {
                                        str.append(line).append("\n");
                                    }
                                }

            } catch (IOException ioe) {
                throw new RuntimeException(
                        "[error] AudioLayer could not load instr text");
            }

            INSTR_TEXT = new MessageFormat(str.toString());
        }

        return INSTR_TEXT.format(new Object[]{var1, var2});

    }

    protected int generateInstrumentForAudioLayer(CompileData compileData) {

        if (compileData.getCompilationVariable(this.uniqueId) != null) {
            return (Integer) compileData.getCompilationVariable(this.uniqueId);
        }

        Map<Channel, Integer> assignments = compileData.getChannelIdAssignments();

        Channel c = null;
        for (Channel channel : assignments.keySet()) {
            if (uniqueId.equals(channel.getAssociation())) {
                c = channel;
            }
        }

        GenericInstrument instr = new GenericInstrument();
        StringBuilder str = new StringBuilder();

        try {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(
                    this.getClass().getClassLoader().getResourceAsStream(
                            "blue/score/layers/audio/core/playback_instrument.orc")))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            str.append(line).append("\n");
                        }
                    }

        } catch (IOException ioe) {
            throw new RuntimeException(
                    "[error] AudioLayer could not load instr text");
        }

        if (c != null) {
            int channelId = assignments.get(c);

            String var1 = Mixer.getChannelVar(channelId, 0);
            String var2 = Mixer.getChannelVar(channelId, 1);

            instr.setText(getInstrumentText(var1, var2));
            System.out.println("Instr Text: " + instr.getText());
        } else {
            instr.setText(getInstrumentText("a1", "a2") + "\noutc a1, a2\n");
        }

        int instrId = compileData.addInstrument(instr);

        compileData.setCompilationVariable(this.uniqueId, instrId);
        return instrId;
    }

    NoteList generateForCSD(CompileData compileData, float startTime, float endTime) throws SoundObjectException {
        NoteList notes = new NoteList();

        int instrId = generateInstrumentForAudioLayer(compileData);
        float adjustedEnd = endTime - startTime;

        for (AudioClip clip : this) {

            float clipStart = clip.getStartTime();
            float clipFileStart = clip.getFileStartTime();
            float clipDur = clip.getSubjectiveDuration();
            float clipEnd = clipStart + clipDur;

            Note n = Note.createNote(5);

            if (clipEnd > startTime) {
                if (endTime <= startTime) {

                    float adjustedStart = startTime - clipStart;
                    float eventStart = clipStart - startTime;

                    if (adjustedStart < 0.0f) {
                        adjustedStart = 0.0f;
                    }

                    if (eventStart < 0.0f) {
                        eventStart = 0.0f;
                    }

                    n.setPField(Integer.toString(instrId), 1);
                    n.setStartTime(eventStart);
                    n.setSubjectiveDuration(clipDur - adjustedStart);
                    n.setPField(
                            "\"" + clip.getAudioFile().getAbsolutePath() + "\"",
                            4);
                    n.setPField(Float.toString(adjustedStart + clipFileStart), 5);

                    notes.add(n);
                } else if (clipStart < endTime) {

                    float adjustedStart = startTime - clipStart;
                    float eventStart = clipStart - startTime;
                    float eventDur = clipDur - adjustedStart;

                    if (adjustedStart < 0.0f) {
                        adjustedStart = 0.0f;
                    }

                    if (eventStart < 0.0f) {
                        eventStart = 0.0f;
                    }

                    if (adjustedStart + eventDur > adjustedEnd) {
                        eventDur = adjustedEnd - eventStart;
                    }

                    n.setPField(Integer.toString(instrId), 1);
                    n.setStartTime(eventStart);
                    n.setSubjectiveDuration(eventDur);
                    n.setPField(
                            "\"" + clip.getAudioFile().getAbsolutePath() + "\"",
                            4);
                    n.setPField(Float.toString(adjustedStart + clipFileStart), 5);

                    notes.add(n);
                }
            }

        }
        return notes;
    }


    /* Property Change Event Code */
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (propListeners == null) {
            return;
        }

        Iterator<PropertyChangeListener> iter = new Vector<>(propListeners).iterator();

        while (iter.hasNext()) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            propListeners = new Vector<PropertyChangeListener>();
        }

        if (propListeners.contains(pcl)) {
            return;
        }

        propListeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            return;
        }
        propListeners.remove(pcl);
    }

    /* Audio Layer Listener Code */
    protected void fireAudioClipAdded(AudioClip clip) {
        if (layerListeners == null) {
            return;
        }
        for (AudioLayerListener listener : layerListeners) {
            listener.audioClipAdded(this, clip);
        }
    }

    protected void fireAudioClipRemoved(AudioClip clip) {
        if (layerListeners == null) {
            return;
        }
        for (AudioLayerListener listener : layerListeners) {
            listener.audioClipRemoved(this, clip);
        }
    }

    public void addAudioLayerListener(AudioLayerListener listener) {
        if (layerListeners == null) {
            layerListeners = new Vector<>();
        }

        if (layerListeners.contains(listener)) {
            return;
        }

        layerListeners.add(listener);
    }

    public void removeAudioLayerListener(AudioLayerListener listener) {
        if (layerListeners == null) {
            return;
        }
        layerListeners.remove(listener);
    }

    @Override
    public int getLayerHeight() {
        return LAYER_HEIGHT * (heightIndex + 1);
    }

    @Override
    public boolean accepts(ScoreObject object) {
        return (object instanceof AudioClip);
    }

    @Override
    public boolean contains(ScoreObject object) {
        if (!accepts(object)) {
            return false;
        }

        return super.contains(object);
    }

    public float getMaxTime() {
        float max = 0.0f;

        for (AudioClip clip : this) {
            float end = clip.getStartTime() + clip.getSubjectiveDuration();
            if (end > max) {
                max = end;
            }
        }
        return max;
    }

    @Override
    public int hashCode() {
        return System.identityHashCode(this);
    }

    @Override
    public boolean equals(Object obj) {
        return obj == this;
    }
}
