/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject;

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.orchestra.GenericInstrument;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import java.io.Serializable;
import java.util.Map;

/**
 * @author steven
 *
 */
public class FrozenSoundObject extends AbstractSoundObject implements
        Serializable, Cloneable {

    private static final String FSO_INSTR_NAME = "Frozen SoundObject Player Instrument";

    private static final String FSO_HAS_BEEN_COMPILED = "frozenSoundObject.hasBeenCompiled";

//    private static BarRenderer renderer = new FrozenSoundObjectRenderer();
//
//    private static SoundObjectEditor editor = new FrozenSoundObjectEditor();

    private SoundObject frozenSoundObject;

    private String frozenWaveFileName;

    private int numChannels = 0;

    private static transient int instrumentNumber;

    public FrozenSoundObject() {
    }

//    public SoundObjectEditor getEditor() {
//        return editor;
//    }

    public float getObjectiveDuration() {
        return this.subjectiveDuration;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public int getTimeBehavior() {
        return SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED;
    }

    public void setTimeBehavior(int timeBehavior) {
        return;
    }

    public float getRepeatPoint() {
        return -1.0f;
    }

    public void setRepeatPoint(float repeatPoint) {
    }

    public SoundObject getFrozenSoundObject() {
        return frozenSoundObject;
    }

    public void setFrozenSoundObject(SoundObject frozenSoundObject) {
        this.frozenSoundObject = frozenSoundObject;
    }

    public String getFrozenWaveFileName() {
        return frozenWaveFileName;
    }

    public void setFrozenWaveFileName(String frozenWaveFileName) {
        this.frozenWaveFileName = frozenWaveFileName;
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
        NoteList n = new NoteList();

        if (instrumentNumber == 0) {
            return n;
        }

        float newDur = subjectiveDuration;

        if(renderEnd > 0 && renderEnd < subjectiveDuration) {
            newDur = renderEnd;
        }

        newDur = newDur - renderStart;

        StringBuilder buffer = new StringBuilder();

        buffer.append("i").append(instrumentNumber);
        buffer.append("\t").append(startTime + renderStart);
        buffer.append("\t").append(newDur);
        buffer.append("\t\"").append(this.getFrozenWaveFileName()).append("\"");
        buffer.append("\t").append(renderStart);


//        String noteText = "i" + instrumentNumber + "\t" + startTime + "\t"
//                + subjectiveDuration + "\t" + "\""
//                + this.getFrozenWaveFileName() + "\"";

        Note tempNote = null;

        try {
            tempNote = Note.createNote(buffer.toString());
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }

        if (tempNote != null) {
            n.addNote(tempNote);
        }

        return n;
    }

    public void generateInstruments(CompileData compileData) {

        Object obj = compileData.getCompilationVariable(FSO_HAS_BEEN_COMPILED);

        if (obj == null || obj != Boolean.TRUE) {

            compileData.setCompilationVariable(FSO_HAS_BEEN_COMPILED,
                    Boolean.TRUE);

            String instrumentText = generateInstrumentText();
            if (instrumentText == null) {
                throw new RuntimeException(new SoundObjectException(this,  BlueSystem
                        .getString("audioFile.couldNotGenerate")
                        + " " + getName()));
            }

            GenericInstrument temp = new GenericInstrument();
            temp.setName(FSO_INSTR_NAME);
            temp.setText(instrumentText);
            temp.setEnabled(true);
            int iNum = compileData.addInstrument(temp);
            instrumentNumber = iNum;
        }
    }

    private String generateInstrumentText() {
        StringBuilder iText = new StringBuilder();
        String channelVariables = getChannelVariables();

        if (channelVariables == null) {
            return null;
        }

        iText.append(channelVariables).append("\tdiskin2\tp4, 1, p5\n");
        if (this.numChannels == 1) {
            iText.append("\tout\t").append(channelVariables);
        } else {
            iText.append("\toutc\t").append(channelVariables);
        }

        return iText.toString();
    }

    private String getChannelVariables() {
        if (numChannels <= 0) {
            return null;
        }

        String info = "aChannel1";

        int i = 1;

        while (i < numChannels) {
            i++;
            info += ", aChannel" + i;
        }

        return info;
    }

    public static void main(String[] args) {
    }

    /**
     * @return
     */
    public int getNumChannels() {
        return numChannels;
    }

    /**
     * @param i
     */
    public void setNumChannels(int i) {
        numChannels = i;
    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        FrozenSoundObject fso = new FrozenSoundObject();

        SoundObjectUtilities.initBasicFromXML(data, fso);

        fso.setNumChannels(Integer.parseInt(data.getElement("numChannels")
                .getTextString()));
        fso.setFrozenWaveFileName(data.getElement("frozenWaveFileName")
                .getTextString());
        fso.setFrozenSoundObject((SoundObject) ObjectUtilities.loadFromXML(data
                .getElement("soundObject"), objRefMap));

        return fso;

    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("numChannels").setText(
                Integer.toString(this.getNumChannels()));
        retVal.addElement("frozenWaveFileName").setText(
                this.getFrozenWaveFileName());
        retVal.addElement(this.getFrozenSoundObject().saveAsXML(objRefMap));

        return retVal;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, 
            float endTime) throws SoundObjectException {
        
        generateInstruments(compileData);
        NoteList nl = generateNotes(startTime, endTime);
        
        return nl;
    }

}