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
package blue;

/**
 * @author steven
 */
public class SoundLayerException extends Exception {

    /**
     * SoundLayer where Exception originated
     */

    private SoundLayer soundLayer;

    /**
     * Holds the text of the actual message
     */
    private String message;

    /**
     * An exception that caused an error in the SoundLayer. Usually denotes an
     * error in a sub-SoundLayer or NoteProcessor.
     */
    private Throwable cause;

    private int layerNumber = -1;

    public SoundLayerException(SoundLayer sLayer, String message) {
        this(sLayer, message, null);
    }

    public SoundLayerException(SoundLayer sLayer, String message,
            Throwable cause) {
        this.soundLayer = sLayer;
        this.cause = cause;
        this.message = message;
    }

    public void setLayerNumber(int layerNumber) {
        this.layerNumber = layerNumber;
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
        String retVal;

        if (this.message == null) {
            retVal = null;
        } else {
            retVal = message;
        }

        if (this.layerNumber > 0) {
            retVal += "\nLayer Number: " + this.layerNumber;
        }

        if (this.cause != null) {
            retVal += "\n\nCause:\n" + cause.getMessage(); // TODO - TRANSLATE
        }

        return retVal;
    }

    public SoundLayer getSoundLayer() {
        return this.soundLayer;
    }

}
