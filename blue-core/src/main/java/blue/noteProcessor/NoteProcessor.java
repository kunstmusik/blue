package blue.noteProcessor;

/**
 * Title:        blue
 * Description:  an object composition environment for csound
 * Copyright:    Copyright (c) 2001
 * Company:      steven yi music
 * @author steven yi
 * @version 1.0
 */

import blue.DeepCopyable;
import blue.soundObject.NoteList;
import electric.xml.Element;

public interface NoteProcessor extends DeepCopyable<NoteProcessor> {
    void processNotes(NoteList in) throws NoteProcessorException;
    Element saveAsXML();
}