/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

import blue.scripting.PythonProxy;
import blue.soundObject.NoteList;
import electric.xml.Element;
import java.io.Serializable;
import org.python.core.PyException;

public class PythonProcessor implements NoteProcessor, Serializable {

    private Code code = new Code();

    public void processNotes(NoteList in) throws NoteProcessorException {
        try {
            PythonProxy.processPythonNoteProcessor(in, code.getCode());
        } catch (PyException pyEx) {
            String msg = "Python NoteProcessor Error:\n" + pyEx.toString();
            throw new NoteProcessorException(this, msg);
        }
    }

    @Override
    public String toString() {
        return "[python]";
    }

    public Code getCode() {
        return code;
    }

    public void setCode(Code code) {
        this.code = code;
    }

    public static NoteProcessor loadFromXML(Element data) {
        PythonProcessor ap = new PythonProcessor();

        ap.getCode().setCode(data.getTextString("code"));

        return ap;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        retVal.addElement("code").setText(this.getCode().getCode());

        return retVal;
    }
}
