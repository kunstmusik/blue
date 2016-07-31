/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.noteProcessor;

import blue.BlueSystem;
import blue.plugin.NoteProcessorPlugin;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;
import java.io.Serializable;

/**
 * @author steven
 * 
 */
@NoteProcessorPlugin(displayName="LineMultiplyProcessor", position = 150)
public class LineMultiplyProcessor implements NoteProcessor, Serializable {

    private String lineMultiplyString = "0 0";

    private int pfield = 4;

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#processNotes(blue.soundObject.NoteList)
     */
    @Override
    public void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;
        float oldVal = 0f;
        float multiplyVal = 0f;
        ValueTimeMapper tm = ValueTimeMapper
                .createValueTimeMapper(this.lineMultiplyString);

        if (tm == null) {
            throw new NoteProcessorException(this, BlueSystem
                    .getString("noteProcessorException.lineMultStringErr"),
                    pfield);
        }

        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);
            try {
                oldVal = Float.parseFloat(temp.getPField(this.pfield));
                multiplyVal = tm.getValueForBeat(temp.getStartTime());
            } catch (NumberFormatException ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.pfieldNotFloat"),
                        pfield);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }

            if (Float.isNaN(multiplyVal)) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.noteBeatErr"),
                        pfield);
            }
            temp.setPField(Float.toString(oldVal * multiplyVal), this.pfield);

        }
    }

    @Override
    public String toString() {
        return "[line multiply]";
    }

    public static void main(String[] args) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.add(Note.createNote("i1 " + i + " 1 3 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        LineMultiplyProcessor lmp = new LineMultiplyProcessor();
        lmp.setLineMultiplyString("0 0 5 1 9 0");
        try {
            lmp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public String getPfield() {
        return Integer.toString(pfield);
    }

    public void setPfield(String pfield) {
        this.pfield = Integer.parseInt(pfield);
    }

    public String getLineMultiplyString() {
        return lineMultiplyString;
    }

    public void setLineMultiplyString(String string) {
        lineMultiplyString = string;
    }

    public static NoteProcessor loadFromXML(Element data) {
        LineMultiplyProcessor lmp = new LineMultiplyProcessor();

        lmp.setPfield(data.getElement("pfield").getTextString());
        lmp.setLineMultiplyString(data.getElement("lineMultiplyString")
                .getTextString());

        return lmp;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        retVal.addElement("pfield").setText(this.getPfield());
        retVal.addElement("lineMultiplyString").setText(
                this.getLineMultiplyString());

        return retVal;
    }

}
