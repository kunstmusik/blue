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

/**
 * @author steven
 *
 */
@NoteProcessorPlugin(displayName = "LineAddProcessor", position = 140)
public class LineAddProcessor implements NoteProcessor {

    private String lineAddString = "0 0";

    private int pfield = 4;

    public LineAddProcessor() {
    }

    public LineAddProcessor(LineAddProcessor lap) {
        lineAddString = lap.lineAddString;
        pfield = lap.pfield;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#processNotes(blue.soundObject.NoteList)
     */
    @Override
    public NoteList processNotes(NoteList in) throws NoteProcessorException {
        Note temp;
        double addVal = 0f;
        double oldVal = 0f;
        ValueTimeMapper tm = ValueTimeMapper
                .createValueTimeMapper(this.lineAddString);

        if (tm == null) {
            throw new NoteProcessorException(this, BlueSystem
                    .getString("noteProcessorException.lineAddStringErr"),
                    pfield);
        }

        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);
            try {
                oldVal = Double.parseDouble(temp.getPField(this.pfield));
                addVal = tm.getValueForBeat(temp.getStartTime());
            } catch (NumberFormatException ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.pfieldNotDouble"),
                        pfield);
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.missingPfield"),
                        pfield);
            }

            if (Double.isNaN(addVal)) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.noteBeatErr"),
                        pfield);
            }
            temp.setPField(Double.toString(oldVal + addVal), this.pfield);

        }
        return in;
    }

    @Override
    public String toString() {
        return "[line add]";
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

        LineAddProcessor lap = new LineAddProcessor();
        lap.setLineAddString("0 0 3 -3 6 0");
        try {
            lap.processNotes(n);
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

    public String getLineAddString() {
        return lineAddString;
    }

    public void setLineAddString(String string) {
        lineAddString = string;
    }

    public static NoteProcessor loadFromXML(Element data) {
        LineAddProcessor lap = new LineAddProcessor();

        lap.setPfield(data.getElement("pfield").getTextString());
        lap.setLineAddString(data.getElement("lineAddString").getTextString());

        return lap;
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
        retVal.addElement("lineAddString").setText(this.getLineAddString());

        return retVal;
    }

    @Override
    public LineAddProcessor deepCopy() {
        return new LineAddProcessor(this);
    }

}
