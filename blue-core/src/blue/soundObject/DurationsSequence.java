/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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
import electric.xml.Element;
import java.io.Serializable;
import java.util.StringTokenizer;

/**
 * THIS SOUND OBJECT IS DEPRECATED AND SHOULD NOT BE USED IT IS LEFT IN ONLY FOR
 * BACKWARDS COMPATIBILITY
 */

public class DurationsSequence extends AbstractSoundObject implements
        Serializable, Cloneable, GenericEditable, GenericViewable {

//    private static BarRenderer renderer = new GenericRenderer();

    private String score;

    // private NoteProcessorChain npc = new NoteProcessorChain();

    public DurationsSequence() {
        setName("durations sequence");

        score = ";i# dur etc.";
    }

//    public SoundObjectEditor getEditor() {
//        return new GenericEditor();
//    }

    /*
     * public String generateScore() { StringBuffer tempScore = new
     * StringBuffer(); StringTokenizer temp = new StringTokenizer(score, "\n");
     * String buffer; float totalDur = getTotalDuration(); float tempStart =
     * 0.0f; float tempDur = 0.0f;
     *
     * while(temp.hasMoreTokens()) { buffer = temp.nextToken();
     *
     * if(!buffer.startsWith(";")) { String[] a = getStringArray(new
     * StringTokenizer(buffer)); if(a.length >= 2) { tempDur =
     * Float.parseFloat(a[1]) / totalDur; //gets proportion tempDur =
     * subjectiveDuration * tempDur; a[1] = Float.toString(tempStart) + " " +
     * Float.toString(tempDur);
     *
     * for(int i = 0; i < a.length; i++) { tempScore.append(a[i] + " "); }
     *
     * tempScore.append("\n"); tempStart += tempDur; } else {
     * tempScore.append(";error in " + this.name); } }
     *  } return tempScore.toString(); // }
     */

    public NoteList generateNotes(float renderStart, float renderEnd) {
        StringBuilder tempScore = new StringBuilder();
        StringTokenizer temp = new StringTokenizer(score, "\n");
        String buffer;

        NoteList notes = new NoteList();
        String noteText = "";

        float totalDur = getTotalDuration();
        float tempStart = 0.0f;
        float tempDur = 0.0f;

        while (temp.hasMoreTokens()) {
            buffer = temp.nextToken();

            if (!buffer.startsWith(";")) {
                String[] a = getStringArray(new StringTokenizer(buffer));
                if (a.length >= 2) {
                    tempDur = Float.parseFloat(a[1]) / totalDur;
                    // gets proportion
                    tempDur = subjectiveDuration * tempDur;
                    a[1] = Float.toString(tempStart) + " "
                            + Float.toString(tempDur);

                    for (int i = 0; i < a.length; i++) {
                        noteText += a[i] + " ";
                    }

                    try {
                        notes.addNote(Note.createNote(noteText));
                    } catch (NoteParseException e) {
                        throw new RuntimeException(new SoundObjectException(this, e));
                    }

                    tempStart += tempDur;
                } else {
                    tempScore.append(";error in ").append(this.name);
                }
            }

        }
        return notes;
    }

    private float getTotalDuration() {
        StringTokenizer temp = new StringTokenizer(score, "\n");
        String buffer;
        float tempDuration = 0.0f;
        while (temp.hasMoreTokens()) {
            buffer = temp.nextToken();
            if (!buffer.startsWith(";")) {
                String[] tempArray = getStringArray(new StringTokenizer(buffer));
                tempDuration += Float.parseFloat(tempArray[1]);
            }
        }
        return tempDuration;
    }

    private String[] getStringArray(StringTokenizer in) {
        String[] tempArray = new String[in.countTokens()];
        int i = 0;
        while (in.hasMoreTokens()) {
            tempArray[i] = in.nextToken();
            i++;
        }
        return tempArray;
    }

    /*
     * public void generateInstruments(Orchestra orch) { }
     */

    // public void setScore(String input) {
    // score = input;
    // }
    //
    // public String getScore() {
    // return score;
    // }
    public void setText(String text) {
        this.score = text;
    }

    public String getText() {
        return score;
    }

    public float getObjectiveDuration() {
        return subjectiveDuration;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public Object clone() {
        DurationsSequence buffer = new DurationsSequence();
        buffer.setText(this.score);
        buffer.setStartTime(this.startTime);
        buffer.setSubjectiveDuration(this.subjectiveDuration);
        buffer.setName(this.getName());
        buffer.setRepeatPoint(this.getRepeatPoint());
        return buffer;
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

//    public static void main(String args[]) {
//        DurationsSequence a = new DurationsSequence();
//        a.setText("i1 3 5 6\ni1 3 4 5");
//        a.setSubjectiveDuration(4.0f);
//        try {
//            System.out.println(a.generateNotes(0.0f, -1.0f));
//        } catch (SoundObjectException e) {
//            // TODO Auto-generated catch block
//            e.printStackTrace();
//        }
//    }

    public int getTimeBehavior() {
        return -1;
    }

    public void setTimeBehavior(int timeBehavior) {
    }

    public float getRepeatPoint() {
        return -1.0f;
    }

    public void setRepeatPoint(float repeatPoint) {
    }

    public void generateInstruments(Arrangement arr) {
        return;
    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public SoundObject loadFromXML(Element data, SoundObjectLibrary sObjLibrary) {
        return null;
    }

    /*
     * (non-Javadoc)
     *
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        return null;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) {
        return generateNotes(startTime, endTime);
    }
}