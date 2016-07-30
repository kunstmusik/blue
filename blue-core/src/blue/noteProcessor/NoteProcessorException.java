/*
 * NoteProcessorException.java
 *
 * Created on April 7, 2005, 10:39 AM
 */

package blue.noteProcessor;

import blue.utility.ObjectUtilities;
import java.text.MessageFormat;

/**
 * Exception class for NoteProcessors to utilize when an error has occured.
 * 
 * @author Michael Bechard
 * @author Steven Yi
 * @version 1.1
 */
public class NoteProcessorException extends Exception {

    /**
     * Holds the text of the actual message
     */
    protected String message;

    /**
     * The pfield that is related to the exception
     */
    protected int pfield;

    /**
     * Name of the noteProcessor that threw the exception
     */
    protected NoteProcessor noteProcessor;

    private static final MessageFormat messageFormat = new MessageFormat(
            "pfield {0}: {1}");

    public NoteProcessorException(NoteProcessor noteProcessor) {
        this(noteProcessor, null);
    }

    public NoteProcessorException(NoteProcessor noteProcessor, String message) {
        this(noteProcessor, message, -1);
    }

    public NoteProcessorException(NoteProcessor noteProcessor, String message,
            int pfield) {
        this.noteProcessor = noteProcessor;
        this.message = message;
        this.pfield = pfield;
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
        if (this.message == null) {
            return null;
        } else if (this.pfield == -1) {
            return message;
        } else {
            Object[] args = { new Integer(pfield), message };
            return messageFormat.format(args);
        }
    }

    public String getProcessorName() {
        return ObjectUtilities.getShortClassName(this.noteProcessor);
    }

    public int getPField() {
        return pfield;
    }
}
