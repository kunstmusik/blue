/*
 * blue - object composition environment for csound Copyright (c) 2001-2016
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
import blue.orchestra.BlueSynthBuilder;
import blue.plugin.SoundObjectPlugin;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.Map;


/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @created November 11, 2001
 * @version 1.0
 */
@SoundObjectPlugin(displayName = "Sound", live=false, position = 130)
public class Sound extends AbstractSoundObject implements Serializable,
        Cloneable {

//    BSBGraphicInterface graphicInterface;
//
//    PresetGroup presetGroup;
    
    BlueSynthBuilder bsbObj;
    
    String instrument;

    public Sound() {
        setName("Sound");
//        instrument = BlueSystem.getString("sound.defaultCode");
//        graphicInterface = new BSBGraphicInterface();
//        presetGroup = new PresetGroup();
        bsbObj = new BlueSynthBuilder();
    }

    @Override
    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public BlueSynthBuilder getBlueSynthBuilder() {
        return this.bsbObj;
    }
    
    public void setBlueSynthBuilder(BlueSynthBuilder bsbObj) {
        this.bsbObj = bsbObj;
    }
    
//    public String getText() {
//        return instrument;
//    }
//
//    public void setText(String text) {
//        this.instrument = text;
//    }
    
//    public BSBGraphicInterface getGraphicInterface() {
//        return graphicInterface;
//    }
//
//    public void setGraphicInterface(BSBGraphicInterface graphicInterface) {
//        this.graphicInterface = graphicInterface;
//    }
//
//    public PresetGroup getPresetGroup() {
//        return presetGroup;
//    }
//
//    public void setPresetGroup(PresetGroup presetGroup) {
//        this.presetGroup = presetGroup;
//    }

    public NoteList generateNotes(int instrumentNumber, float renderStart, float renderEnd) throws SoundObjectException {
        NoteList n = new NoteList();

        String noteText = "i" + instrumentNumber + "\t" + startTime + "\t"
                + subjectiveDuration;

        Note tempNote = null;

        try {
            tempNote = Note.createNote(noteText);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
        }

        if (tempNote != null) {
            n.add(tempNote);
        }

        return n;
    }

    @Override
    public int getTimeBehavior() {
        return SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED;
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
    }

    @Override
    public float getRepeatPoint() {
        return -1.0f;
    }

    @Override
    public void setRepeatPoint(float repeatPoint) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        Sound sObj = new Sound();

        SoundObjectUtilities.initBasicFromXML(data, sObj);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                // For backwards compatibility with Blue versions < 2.6.0
                case "instrumentText":
                    sObj.bsbObj.setInstrumentText(node.getTextString());
                    break;
                case "instrument":
                    sObj.bsbObj = (BlueSynthBuilder) 
                            BlueSynthBuilder.loadFromXML(node);
//                case "graphicInterface":
//                    sObj.setGraphicInterface(BSBGraphicInterface.loadFromXML(node));
//                    break;
//                case "presetGroup":
//                    sObj.setPresetGroup(PresetGroup.loadFromXML(node));
//                    break;
            }

        }
 
//       
//        sObj.setText(data.getTextString("instrumentText"));

        return sObj;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement(bsbObj.saveAsXML());
//        retVal.addElement("instrumentText").setText(this.getText());
//        retVal.addElement(graphicInterface.saveAsXML());
//        retVal.addElement(presetGroup.saveAsXML());
        
        return retVal;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, 
            float endTime) throws SoundObjectException {
        
//        Instrument instr = generateInstrument();
        bsbObj.getParameterList().clearCompilationVarNames();
        int instrNum = compileData.addInstrument(bsbObj);
        
        return generateNotes(instrNum, startTime, endTime);

    }
}