/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import blue.score.ScoreGenerationException;
import blue.utility.ObjectUtilities;
import java.text.MessageFormat;

/**
 * @author steven
 */
public class SoundObjectException extends ScoreGenerationException {

    /**
     * SoundObject where Exception originated
     */

    private final SoundObject soundObject;

    /**
     * Holds the text of the actual message
     */
    private final String message;

    /**
     * An exception that caused an error in the SoundObject. Usually denotes an
     * error in a sub-SoundObject or NoteProcessor.
     */
    private final Throwable cause;

    private static final MessageFormat lineMessageFormat = new MessageFormat(
            "Line {0}: {1}");

    private static final MessageFormat mainMessageFormat = new MessageFormat(
            "There was an score generation error in the soundObject:\n\n"
                    + "Type: {0}" + "Name: {1}\n" + "Start Time: {2}");

    public SoundObjectException(SoundObject sObj, Throwable cause) {
        this(sObj, null, cause);
    }

    public SoundObjectException(SoundObject sObj, String message) {
        this(sObj, message, null);
    }

    public SoundObjectException(SoundObject sObj, String message,
            Throwable cause) {
        this.soundObject = sObj;
        this.cause = cause;
        this.message = message;
    }

    /**
     * Overrides Exception.getMessage to provide a message that includes the
     * pfield as well as the actual user-defined message.
     * 
     * @return Message describing why the noteProcessor couldn't execute. Should
     *         be a readable message, digestable by the user.
     */
    @Override
    public String getMessage() {
        Object[] mainArgs = new Object[] {
                ObjectUtilities.getShortClassName(soundObject),
                soundObject.getName(), new Double(soundObject.getStartTime()) };
        String retVal = mainMessageFormat.format(mainArgs);

        if (this.message != null) {
            retVal += "\n\nDetails:\n" + message; // TODO - TRANSLATE
        }

        if (this.cause != null) {
            retVal += "\n\nCause:\n" + cause.getMessage(); // TODO - TRANSLATE
        }

        return retVal;
    }

    public SoundObject getSoundObject() {
        return this.soundObject;
    }

}
