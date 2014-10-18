/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

/**
 * @author steven
 */
public class NoteParseException extends Exception {

    private String errorMessage;

    private String badNoteText;

    private int lineNum = -1;

    public NoteParseException(String errorMessage, String badNoteText) {
        this.errorMessage = errorMessage;
        this.badNoteText = badNoteText;
    }

    public void setLineNumber(int lineNum) {

        this.lineNum = lineNum;
    }

    public String getMessage() {
        String errorMessage = "NoteParseException";

        if (this.lineNum > 0) {
            errorMessage += "\nLine Number: " + this.lineNum;
        }

        errorMessage += "\nNote Text: " + this.badNoteText;

        errorMessage += "\nDetails:\n" + this.errorMessage;

        return errorMessage;

    }
}