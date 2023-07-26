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

import blue.BlueSystem;
import blue.CompileData;
import blue.automation.ParameterIdList;
import blue.mixer.Channel;
import blue.mixer.Mixer;
import blue.orchestra.GenericInstrument;
import blue.score.ScoreObject;
import blue.score.layers.AutomatableLayer;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 *
 */
public class AudioLayer extends ArrayList<AudioClip>
        implements ScoreObjectLayer<AudioClip>, AutomatableLayer {

    public static int HEIGHT_MAX_INDEX = 9;

    private static MessageFormat INSTR_TEXT = null;

    private String name = "";
    private boolean muted = false;
    private boolean solo = false;
    private String uniqueId;

    private int heightIndex = 0;
    private ParameterIdList automationParameters; 

    private transient List<PropertyChangeListener> propListeners = null;
    private transient List<AudioLayerListener> layerListeners = null;

    public AudioLayer() {
        this.uniqueId = new VMID().toString();
        automationParameters = new ParameterIdList();
    }

    public AudioLayer(AudioLayer al) {
        super(al.size());
        this.uniqueId = al.uniqueId;
        automationParameters = new ParameterIdList(al.automationParameters);
        name = al.name;
        muted = al.muted;
        solo = al.solo;
        heightIndex = al.heightIndex;

        for(AudioClip ac : al) {
            add(ac.deepCopy());
        }
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

    @Override
    public int getHeightIndex() {
        return heightIndex;
    }

    @Override
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

    @Override
    public ParameterIdList getAutomationParameters() {
        return automationParameters;
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

        for (String id : automationParameters ) {
            retVal.addElement("parameterId").setText(id);
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
            Element node = nodes.next();
            switch (node.getName()) {
                case "audioClip":
                    layer.add(AudioClip.loadFromXML(node));
                    break;
                case "parameterId":
                    String id = node.getTextString();
                    layer.automationParameters.addParameterId(id);
                    break;
            }
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
                    this.getClass().getResourceAsStream(
                            "playback_instrument.orc")))) {
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
//            System.out.println("Instr Text: " + instr.getText());
        } else {
            throw new RuntimeException("Error: could not find Mixer Channels for Audio layer");
//            instr.setText(getInstrumentText("a1", "a2") + "\noutc a1, a2\n");
        }

        int instrId = compileData.addInstrument(instr);

        compileData.setCompilationVariable(this.uniqueId, instrId);
        return instrId;
    }

    NoteList generateForCSD(CompileData compileData, double startTime, double endTime) throws SoundObjectException {
        
        if(compileData.getCompilationVariable("BLUE_FADE_UDO") == null) {
            StringBuilder str = new StringBuilder();
            try {
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(
                                this.getClass().getClassLoader().getResourceAsStream(
                                        "blue/score/layers/audio/core/blue_fade.udo")))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        str.append(line).append("\n");
                    }
                }
                compileData.appendGlobalOrc(str.toString());
            } catch (IOException ioe) {
                throw new RuntimeException(
                        "[error] AudioLayer could not load blue_fade.udo");
            }
            
            compileData.setCompilationVariable("BLUE_FADE_UDO", new Object());
        }
        
        NoteList notes = new NoteList();

        int instrId = generateInstrumentForAudioLayer(compileData);
        boolean usesEndTime = endTime > startTime;
        double adjustedEndTime = endTime - startTime;

        for (AudioClip clip : this) {

            double clipStart = clip.getStartTime();
            double clipFileStart = clip.getFileStartTime();
            double clipDur = clip.getSubjectiveDuration();
            double clipEnd = clipStart + clipDur;

            if (clipEnd <= startTime
                    || (usesEndTime && clipStart >= endTime)) {
                continue;
            }

            Note n = Note.createNote(12);

            double adjustedStart = clipStart - startTime;
            double adjustedEnd = clipEnd - startTime;

            double startOffset = Math.max(startTime - clipStart, 0.0f);
            double newStart = Math.max(adjustedStart, 0.0f);
            double newEnd = clipEnd - startTime;

            double newDuration
                    = (usesEndTime && newEnd > adjustedEndTime)
                            ? adjustedEndTime - newStart
                            : (newEnd - newStart);

            var f = clip.getAudioFile();
            
            String path;
            try {
                path = BlueSystem.getRelativePath(f.getCanonicalPath());
                path = path.replace('\\', '/');
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
                path = f.getAbsolutePath();
            }
            

            n.setPField(Integer.toString(instrId), 1);
            n.setStartTime(newStart);
            n.setSubjectiveDuration(newDuration);
            n.setPField(
                    "\"" + path + "\"",
                    4);
            n.setPField(Double.toString(clipFileStart), 5);
            
            n.setPField(Double.toString(startOffset), 6);
            n.setPField(Double.toString(clipDur), 7);

            
            int fadeType = clip.getFadeInType().ordinal();
            n.setPField(Integer.toString(fadeType), 8);
            n.setPField(Double.toString(clip.getFadeIn()), 9);
            
            fadeType = clip.getFadeOutType().ordinal();
            n.setPField(Integer.toString(fadeType), 10);
            n.setPField(Double.toString(clip.getFadeOut()), 11);
            
            n.setPField(clip.isLooping() ? "1" : "0", 12);

            notes.add(n);

        }
        return notes;
    }


    /* Property Change Event Code */
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (propListeners == null) {
            return;
        }

        for (PropertyChangeListener listener : propListeners) {
            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            propListeners = Collections.synchronizedList(new ArrayList<>());
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
            layerListeners = Collections.synchronizedList(new ArrayList<>());
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

    public double getMaxTime() {
        double max = 0.0f;

        for (AudioClip clip : this) {
            double end = clip.getStartTime() + clip.getSubjectiveDuration();
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

    @Override
    public void clearScoreObjects() {
        this.clear();
    }

    @Override
    public AudioLayer deepCopy() {
        return new AudioLayer(this);
    }
}
