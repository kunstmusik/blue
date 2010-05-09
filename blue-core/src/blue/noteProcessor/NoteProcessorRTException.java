/*
 * NoteProcessorRTException.java
 *
 * Created on April 7, 2005, 1:45 PM
 */

package blue.noteProcessor;

/**
 * 
 * @author mbechard
 */
public class NoteProcessorRTException extends RuntimeException {

    /** Creates a new instance of NoteProcessorRTException */
    public NoteProcessorRTException(String message, NoteProcessorException cause) {
        super(message, cause);
    }

}
