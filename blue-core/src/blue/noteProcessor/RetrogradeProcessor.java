package blue.noteProcessor;

import blue.plugin.NoteProcessorPlugin;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author steven yi
 * @version 1.0
 */

@NoteProcessorPlugin(displayName="RetrogradeProcessor", position = 80)
public class RetrogradeProcessor implements NoteProcessor, java.io.Serializable {

    public RetrogradeProcessor() {
    }

    @Override
    public String toString() {
        return "[retrograde]";
    }

    public final void processNotes(NoteList in) {
        in.sort();
        Note temp;
        int size = in.size();
        temp = in.get(in.size() - 1);
        float totalTime = temp.getStartTime() + temp.getSubjectiveDuration();

        for (int i = 0; i < size; i++) {
            temp = in.get(i);
            // System.out.println("obj: " + temp.getObjectiveDuration() + "
            // subj: " + temp.getSubjectiveDuration());
            temp.setStartTime(totalTime
                    - (temp.getStartTime() + temp.getSubjectiveDuration()));
        }
    }

    public static void main(String[] args) {
        NoteList n = new NoteList();

        for (int i = 0; i < 10; i++) {
            try {
                n.add(Note.createNote("i1 " + i + " " + i + " 6." + i
                        + " 4"));
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
        }

        System.out.println("before: \n\n" + n + "\n\n");

        RetrogradeProcessor retro = new RetrogradeProcessor();
        retro.processNotes(n);

        System.out.println("after: \n\n" + n + "\n\n");

    }

    public static NoteProcessor loadFromXML(Element data) {
        return new RetrogradeProcessor();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = new Element("noteProcessor");
        retVal.setAttribute("type", this.getClass().getName());

        return retVal;
    }
}