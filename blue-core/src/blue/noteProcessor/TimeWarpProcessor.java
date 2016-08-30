package blue.noteProcessor;

import blue.BlueSystem;
import blue.plugin.NoteProcessorPlugin;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import electric.xml.Element;

/**
 * 
 * Maps beats-to-seconds for time warping (accelerando, ritardando)
 * 
 * Based on code from OMDE (http://pythonsound.sourceforge.net/)
 * 
 * @author steven
 */

@NoteProcessorPlugin(displayName="TimeWarpProcessor", position = 130)
public class TimeWarpProcessor implements NoteProcessor, java.io.Serializable {

    private String timeWarpString = "0 60";

    public TimeWarpProcessor() {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.noteProcessor.NoteProcessor#processNotes(blue.soundObject.NoteList)
     */
    @Override
    public void processNotes(NoteList in) throws NoteProcessorException {
        Note temp;
        TempoMapper tm = TempoMapper.createTempoMapper(this.timeWarpString);

        if (tm == null) {
            throw new NoteProcessorException(this, BlueSystem
                    .getString("noteProcessorException.tempoStringErr"));
        }

        float newStart, newEnd;

        for (int i = 0; i < in.size(); i++) {
            temp = in.get(i);
            try {
                newStart = tm.beatsToSeconds(temp.getStartTime());
                newEnd = tm.beatsToSeconds(temp.getStartTime()
                        + temp.getSubjectiveDuration());
            } catch (Exception ex) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.timeWarp"));
            }
            temp.setStartTime(newStart);
            if (newEnd - newStart < 0) {
                throw new NoteProcessorException(this, BlueSystem
                        .getString("noteProcessorException.timeWarp"));
            }
            temp.setSubjectiveDuration(newEnd - newStart);
        }
    }

    @Override
    public String toString() {
        return "[time warp]";
    }

    /**
     * @return
     */
    public String getTimeWarpString() {
        return timeWarpString;
    }

    /**
     * @param string
     */
    public void setTimeWarpString(String timeWarpString) {
        this.timeWarpString = timeWarpString;
    }

    // UNIT TEST

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

        TimeWarpProcessor twp = new TimeWarpProcessor();
        twp.setTimeWarpString("0 60 4 120");
        try {
            twp.processNotes(n);
        } catch (NoteProcessorException ex) {
            System.out.println("Exception: " + ex.getMessage());
        }

        System.out.println("after: \n\n" + n + "\n\n");
    }

    public static NoteProcessor loadFromXML(Element data) {
        TimeWarpProcessor twp = new TimeWarpProcessor();

        twp
                .setTimeWarpString(data.getElement("timeWarpString")
                        .getTextString());

        return twp;
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

        retVal.addElement("timeWarpString").setText(this.getTimeWarpString());

        return retVal;
    }

}
