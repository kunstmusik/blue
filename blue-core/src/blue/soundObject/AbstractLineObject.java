/*
 * AbstractLineObject.java
 *
 * Created on July 14, 2005, 10:12 AM
 */

package blue.soundObject;

import blue.Arrangement;
import blue.GlobalOrcSco;
import blue.SoundObjectLibrary;
import blue.Tables;
import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.noteProcessor.NoteProcessorChain;
import blue.orchestra.GenericInstrument;
import blue.utility.NumberUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Iterator;

/**
 * Base class for line objects. Most of this functionality was extracted from
 * the previous version of LineObject in order to make it more flexible.
 *
 * @author mbechard
 */
public abstract class AbstractLineObject extends AbstractSoundObject implements
        Serializable {

    private static String LINE_OBJECT_CACHE = "abstractLineObject.lineObjectCache";

//    private static BarRenderer renderer = new LetterRenderer("L");

    protected transient HashMap ftableNumMap = null;

    protected transient Integer[] instrLineArray;

    protected LineList lines = new LineList();

    /** Creates a new instance of AbstractLineObject */
    public AbstractLineObject() {
        // overrider ctor here to set object's name
    }

    /* METHODS SPECIFIC TO LINE OBJECT */

    public LineList getLines() {
        return lines;
    }

    public void setLines(LineList lines) {
        this.lines = lines;
    }

    /* RENDER TO CSD FUNCTIONS */

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
        initializeCompileState();
    }

    public NoteList generateNotes(float renderStart, float renderEnd)
            throws SoundObjectException {

        NoteList notes = new NoteList();

        float newDur = subjectiveDuration;

        if (renderEnd > 0 && renderEnd < subjectiveDuration) {
            newDur = renderEnd;
        }

        newDur = newDur - renderStart;


        StringBuffer buffer = new StringBuffer();

        for (int i = 0; i < this.instrLineArray.length; i += 2) {
            Integer instrNum = instrLineArray[i];
            Integer lineNum = instrLineArray[i + 1];

            buffer.append("i").append(instrNum).append(" ");
            buffer.append(renderStart).append(" ").append(newDur)
                    .append(" ");
            buffer.append(renderStart / subjectiveDuration).append(" ");

            if(renderEnd > 0) {
                buffer.append(renderEnd / subjectiveDuration).append(" ");
            } else {
                buffer.append(" 1 ");
            }
            buffer.append(lineNum);

            try {
                notes.addNote(Note.createNote(buffer.toString()));
            } catch (NoteParseException e) {
                throw new SoundObjectException(this, e);
            }

            buffer.delete(0, buffer.length());
        }

        ScoreUtilities.setScoreStart(notes, startTime);

        clearCompileState();

        return notes;
    }

    protected void initializeCompileState() {
        instrLineArray = new Integer[lines.size() * 2];
        ftableNumMap = new HashMap();
    }

    protected void clearCompileState() {
        instrLineArray = null;
        ftableNumMap.clear();
        ftableNumMap = null;
    }

    protected String createTable(Line line) {
        // float range = line.getMax() - line.getMin();
        // float min = line.getMin();

        StringBuffer buffer = new StringBuffer();

        int genSize = getGenSize();

        buffer.append(" 0 ");
        buffer.append(genSize);
        buffer.append(" -7 ");

        float lastTime = 0.0f;
        boolean firstPoint = true;

        for (int i = 0; i < line.size(); i++) {
            LinePoint point = line.getLinePoint(i);

            float newTime = point.getX() * genSize;
            float dur = Math.max(newTime - lastTime, 0);

            float yVal = point.getY();

            // System.out.println(yVal);

            if (firstPoint) {
                firstPoint = false;
            } else {
                buffer.append(" ");
                buffer.append(NumberUtilities.formatFloat(dur));
            }

            buffer.append(" ");
            buffer.append(NumberUtilities.formatFloat(yVal));

            lastTime = newTime;
        }

        return buffer.toString();
    }

    protected int getGenSize() {
        return 16384;
    }

    abstract protected String generateLineInstrument(Line line);

    public void generateFTables(Tables tables) {

        StringBuffer buffer = new StringBuffer();

        // TODO - need to grab from tables in static var

        Object obj = tables.getCompilationVariable(LINE_OBJECT_CACHE);

        if (obj == null) {
            HashMap map = new HashMap();
            tables.setCompilationVariable(LINE_OBJECT_CACHE, map);
            obj = map;
        }

        HashMap stringTables = (HashMap) obj;

        for (Iterator iter = lines.iterator(); iter.hasNext();) {

            Line line = (Line) iter.next();
            String table = createTable(line);

            int tableNum;

            if (stringTables.containsKey(table)) {
                tableNum = ((Integer) stringTables.get(table)).intValue();
            } else {
                tableNum = tables.getOpenFTableNumber();
                stringTables.put(table, new Integer(tableNum));
                buffer.append("f").append(tableNum);
                buffer.append(table).append("\n");
            }

            ftableNumMap.put(line.getUniqueID(), new Integer(tableNum));

        }

        tables.setTables(tables.getTables() + "\n" + buffer.toString());
    }

    public void generateInstruments(Arrangement arr) {
        int i = 0;

        for (Iterator iter = lines.iterator(); iter.hasNext();) {
            Line line = (Line) iter.next();

            String lineName;

            if (line.isZak()) {
                lineName = "zak" + line.getChannel();
            } else {
                lineName = line.getVarName();
            }

            String lineId = line.getUniqueID();
            String key = "AbstractLineObject." + lineName;
            Object val = arr.getCompilationVariable(key);
            int instrNum = -1;
            Integer lineNum = (Integer) ftableNumMap.get(lineId);

            if (val == null) {

                String instrText = generateLineInstrument(line);
                GenericInstrument instr = new GenericInstrument();
                instr.setText(instrText);
                instrNum = arr.addInstrument(instr);
                arr.setCompilationVariable(key, new Integer(instrNum));
            } else {
                instrNum = ((Integer) val).intValue();
            }

            instrLineArray[i++] = new Integer(instrNum);
            instrLineArray[i++] = lineNum;
        }
    }

    /* GENERIC SOUND OBJECT METHODS */

    public float getObjectiveDuration() {
        return getSubjectiveDuration();
    }

//    public SoundObjectEditor getEditor() {
//        return new LineEditor();
//    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public int getTimeBehavior() {
        return SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED;
    }

    public void setTimeBehavior(int timeBehavior) {
    }

    public float getRepeatPoint() {
        return -1.0f;
    }

    public void setRepeatPoint(float repeatPoint) {
    }

    /* SERIALIZATION */

    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        for (Iterator iter = lines.iterator(); iter.hasNext();) {
            Line line = (Line) iter.next();
            retVal.addElement(line.saveAsXML());
        }

        return retVal;
    }
}
