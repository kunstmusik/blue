/*
 * blue - object composition environment for csound Copyright (c) 2001-2003
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
import electric.xml.Element;
import java.io.Serializable;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @created November 11, 2001
 * @version 1.0
 */

public class Sound extends AbstractSoundObject implements Serializable,
        Cloneable, GenericEditable {

//    private static BarRenderer renderer = new LetterRenderer("S");

    String instrument;

    // Used during CSD generation time
    int instrumentNumber = 0;

    public Sound() {
        setName("Sound");
        instrument = BlueSystem.getString("sound.defaultCode");
    }

    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public String getText() {
        return instrument;
    }

    public void setText(String text) {
        this.instrument = text;
    }

    public int getInstrumentNumber() {
        return instrumentNumber;
    }

    public void setInstrumentNumber(int num) {
        this.instrumentNumber = num;
    }

//    public SoundObjectEditor getEditor() {
//        return new GenericEditor();
//    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
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
            n.addNote(tempNote);
        }

        return n;
    }

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
    }

    public void generateFTables(Tables tables) {
    }

    public void generateInstruments(Arrangement arrangement) {
        GenericInstrument temp = new GenericInstrument();
        temp.setName(this.name);
        temp.setText(this.instrument);
        temp.setEnabled(true);
        int iNum = arrangement.addInstrument(temp);
        this.setInstrumentNumber(iNum);
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public int getTimeBehavior() {
        return SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED;
    }

    public void setTimeBehavior(int timeBehavior) {
    }

    public float getRepeatPoint() {
        return -1.0f;
    }

    public void setRepeatPoint(float repeatPoint) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            SoundObjectLibrary sObjLibrary) throws Exception {
        Sound sObj = new Sound();

        SoundObjectUtilities.initBasicFromXML(data, sObj);

        sObj.setText(data.getTextString("instrumentText"));

        return sObj;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("instrumentText").setText(this.getText());

        return retVal;
    }
}