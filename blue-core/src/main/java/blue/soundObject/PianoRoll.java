package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import blue.soundObject.pianoRoll.PianoNote;
import blue.soundObject.pianoRoll.Scale;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

/**
 * @author steven yi
 */
@SoundObjectPlugin(displayName = "PianoRoll", live = true, position = 90)
public class PianoRoll extends AbstractSoundObject {

    public static final int DISPLAY_TIME = 0;

    public static final int DISPLAY_NUMBER = 1;

    public static final int GENERATE_FREQUENCY = 0;

    public static final int GENERATE_PCH = 1;

    public static final int GENERATE_MIDI = 2;

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0f;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private Scale scale;

    private ObservableList<PianoNote> notes;

    private String noteTemplate;

    private String instrumentId;

    private int pixelSecond;

    private int noteHeight;

    private transient ArrayList listeners;

    private boolean snapEnabled = false;

    private double snapValue = 1.0f;

    private int timeDisplay = DISPLAY_TIME;

    private int pchGenerationMethod = GENERATE_FREQUENCY;

    private int timeUnit = 5;

    private int transposition = 0;
    
    private ObservableList<FieldDef> fieldDefinitions;


    public PianoRoll() {
        this.setName("PianoRoll");
        timeBehavior = TimeBehavior.SCALE;
        scale = Scale.get12TET();
        notes = FXCollections.observableArrayList();
        noteTemplate = "i <INSTR_ID> <START> <DUR> <FREQ> <AMP>";
        instrumentId = "1";
        pixelSecond = 64;
        noteHeight = 15;
        fieldDefinitions = FXCollections.observableArrayList();
        
        var ampdbField = new FieldDef();
        ampdbField.setFieldName("AMP");
        ampdbField.setFieldType(FieldType.CONTINUOUS);
        fieldDefinitions.add(ampdbField);
    }

    public PianoRoll(PianoRoll pr) {
        super(pr);

        timeBehavior = pr.timeBehavior;
        repeatPoint = pr.repeatPoint;
        npc = new NoteProcessorChain(pr.npc);
        scale = new Scale(pr.scale);
        
                
        fieldDefinitions = FXCollections.observableArrayList();

        for (var fieldDef : pr.getFieldDefinitions()) {
            fieldDefinitions.add(new FieldDef(fieldDef));
        }
        
        notes = FXCollections.observableArrayList();

        for (PianoNote pn : pr.notes) {
            notes.add(new PianoNote(pn));
        }

        noteTemplate = pr.noteTemplate;
        instrumentId = pr.instrumentId;
        pixelSecond = pr.pixelSecond;
        noteHeight = pr.noteHeight;
        snapEnabled = pr.snapEnabled;
        snapValue = pr.snapValue;
        timeDisplay = pr.timeDisplay;
        pchGenerationMethod = pr.pchGenerationMethod;
        timeUnit = pr.timeUnit;
        transposition = pr.transposition;

    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    // TODO - Implement using notes
    @Override
    public double getObjectiveDuration() {
        return this.getSubjectiveDuration();
    }

    public NoteList generateNotes(double renderStart, double renderEnd) throws SoundObjectException {
        NoteList nl = new NoteList();

        String instrId = instrumentId;

        if (instrId != null) {
            instrId = instrId.trim();
        }

        try {
            Integer.parseInt(instrumentId);
        } catch (NumberFormatException nfe) {
            instrId = "\"" + instrId + "\"";
        }

        for (Iterator<PianoNote> iter = notes.iterator(); iter.hasNext();) {
            PianoNote n = iter.next();

            String freq = "";

            int octave = n.getOctave();
            int scaleDegree = n.getScaleDegree() + getTransposition();

            int numScaleDegrees;

            if (getPchGenerationMethod() == GENERATE_MIDI) {
                numScaleDegrees = 12;
            } else {
                numScaleDegrees = scale.getNumScaleDegrees();
            }

            if (scaleDegree >= numScaleDegrees) {
                octave += scaleDegree / numScaleDegrees;
                scaleDegree = scaleDegree % numScaleDegrees;
            }

            if (scaleDegree < 0) {

                int octaveDiff = (scaleDegree * -1) / numScaleDegrees;
                octaveDiff += 1;

                scaleDegree = scaleDegree % numScaleDegrees;

                octave -= octaveDiff;
                scaleDegree = numScaleDegrees + scaleDegree;
            }

            if (this.pchGenerationMethod == GENERATE_FREQUENCY) {
                double f = scale.getFrequency(octave, scaleDegree);
                freq = Double.toString(f);
            } else if (this.pchGenerationMethod == GENERATE_PCH) {
                freq = octave + "." + scaleDegree;
            } else if (this.pchGenerationMethod == GENERATE_MIDI) {
                freq = Integer.toString((octave * 12) + scaleDegree);
            }

            String template = n.getNoteTemplate();

            template = TextUtilities
                    .replaceAll(template, "<INSTR_ID>", instrId);
            template = TextUtilities.replaceAll(template, "<INSTR_NAME>",
                    instrumentId);
            template = TextUtilities.replaceAll(template, "<START>", Double
                    .toString(n.getStart()));
            template = TextUtilities.replaceAll(template, "<DUR>", Double
                    .toString(n.getDuration()));
            template = TextUtilities.replaceAll(template, "<FREQ>", freq);

            Note note = null;

            try {
                note = Note.createNote(template);
            } catch (NoteParseException e) {
                throw new SoundObjectException(this, e);
            }

            nl.add(note);
        }

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());

        ScoreUtilities.setScoreStart(nl, startTime);

        return nl;
    }

    @Override
    public TimeBehavior getTimeBehavior() {
        return this.timeBehavior;
    }

    @Override
    public void setTimeBehavior(TimeBehavior timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public double getRepeatPoint() {
        return this.repeatPoint;
    }

    @Override
    public void setRepeatPoint(double repeatPoint) {
        this.repeatPoint = repeatPoint;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.REPEAT_POINT);

        fireScoreObjectEvent(event);
    }

    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {

        PianoRoll p = new PianoRoll();
        SoundObjectUtilities.initBasicFromXML(data, p);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element e = nodes.next();

            String nodeName = e.getName();
            switch (nodeName) {
                case "noteTemplate":
                    p.setNoteTemplate(e.getTextString());
                    break;
                case "instrumentId":
                    p.setInstrumentId(e.getTextString());
                    break;
                case "scale":
                    p.setScale(Scale.loadFromXML(e));
                    break;
                case "pixelSecond":
                    p.setPixelSecond(Integer.parseInt(e.getTextString()));
                    break;
                case "noteHeight":
                    p.setNoteHeight(Integer.parseInt(e.getTextString()));
                    break;
                case "snapEnabled":
                    p.setSnapEnabled(Boolean.valueOf(e.getTextString())
                            .booleanValue());
                    break;
                case "snapValue":
                    p.setSnapValue(Double.parseDouble(e.getTextString()));
                    break;
                case "timeDisplay":
                    p.setTimeDisplay(Integer.parseInt(e.getTextString()));
                    break;
                case "timeUnit":
                    p.setTimeUnit(Integer.parseInt(e.getTextString()));
                    break;
                case "pianoNote":
                    p.notes.add(PianoNote.loadFromXML(e));
                    break;
                case "pchGenerationMethod":
                    p.setPchGenerationMethod(Integer.parseInt(e.getTextString()));
                    break;
                case "transposition":
                    p.setTransposition(Integer.parseInt(e.getTextString()));
                    break;
            }
        }

        return p;
    }

    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("noteTemplate").setText(getNoteTemplate());
        retVal.addElement("instrumentId").setText(getInstrumentId());
        retVal.addElement(scale.saveAsXML());

        retVal.addElement("pixelSecond").setText(
                Integer.toString(this.getPixelSecond()));
        retVal.addElement("noteHeight").setText(
                Integer.toString(this.getNoteHeight()));

        retVal.addElement("snapEnabled").setText(
                Boolean.toString(this.isSnapEnabled()));
        retVal.addElement("snapValue").setText(
                Double.toString(this.getSnapValue()));
        retVal.addElement("timeDisplay").setText(
                Integer.toString(this.getTimeDisplay()));
        retVal.addElement("timeUnit").setText(
                Integer.toString(this.getTimeUnit()));

        retVal.addElement("pchGenerationMethod").setText(
                Integer.toString(this.getPchGenerationMethod()));

        retVal.addElement("transposition").setText(
                Integer.toString(this.getTransposition()));

        for (Iterator<PianoNote> iter = notes.iterator(); iter.hasNext();) {
            PianoNote note = iter.next();
            retVal.addElement(note.saveAsXML());
        }

        return retVal;
    }

    /**
     * @return Returns the notes.
     */
    public ObservableList<PianoNote> getNotes() {
        return notes;
    }

    public ObservableList<FieldDef> getFieldDefinitions() {
        return fieldDefinitions;
    }
    

    /**
     * @return Returns the noteTemplate.
     */
    public String getNoteTemplate() {
        return noteTemplate;
    }

    /**
     * @param noteTemplate The noteTemplate to set.
     */
    public void setNoteTemplate(String noteTemplate) {
        this.noteTemplate = noteTemplate;
    }

    /**
     * @return Returns the scale.
     */
    public Scale getScale() {
        return scale;
    }

    /**
     * @param scale The scale to set.
     */
    public void setScale(Scale scale) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "scale",
                this.scale, scale);

        this.scale = scale;

        firePropertyChange(pce);
    }

    /* PROPERTY CHANGE EVENTS */
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        checkListenersExists();
        this.listeners.add(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        checkListenersExists();
        this.listeners.remove(listener);
    }

    public void firePropertyChange(PropertyChangeEvent pce) {
        checkListenersExists();

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();
            listener.propertyChange(pce);
        }
    }

    private void checkListenersExists() {
        if (listeners == null) {
            listeners = new ArrayList();
        }
    }

    /**
     * @return Returns the pixelSecond.
     */
    public int getPixelSecond() {
        return pixelSecond;
    }

    /**
     * @param pixelSecond The pixelSecond to set.
     */
    public void setPixelSecond(int pixelSecond) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "pixelSecond",
                new Integer(this.pixelSecond), new Integer(pixelSecond));

        this.pixelSecond = pixelSecond;

        firePropertyChange(pce);

    }

    /**
     * @return Returns the noteHeight.
     */
    public int getNoteHeight() {
        return noteHeight;
    }

    /**
     * @param pixelSecond The pixelSecond to set.
     */
    public void setNoteHeight(int noteHeight) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "noteHeight",
                new Integer(this.noteHeight), new Integer(noteHeight));

        this.noteHeight = noteHeight;

        firePropertyChange(pce);

    }

    /**
     * @return Returns the snapEnabled.
     */
    public boolean isSnapEnabled() {
        return snapEnabled;
    }

    public void setSnapEnabled(boolean snapEnabled) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapEnabled",
                Boolean.valueOf(this.snapEnabled), Boolean.valueOf(snapEnabled));

        this.snapEnabled = snapEnabled;

        firePropertyChange(pce);
    }

    public double getSnapValue() {
        return this.snapValue;
    }

    public void setSnapValue(double snapValue) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapValue",
                new Double(this.snapValue), new Double(snapValue));

        this.snapValue = snapValue;

        firePropertyChange(pce);
    }

    public int getTimeDisplay() {
        return timeDisplay;
    }

    public void setTimeDisplay(int timeDisplay) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeDisplay",
                new Integer(this.timeDisplay), new Integer(timeDisplay));

        this.timeDisplay = timeDisplay;

        firePropertyChange(pce);
    }

    public int getTimeUnit() {
        return timeUnit;
    }

    public void setTimeUnit(int timeUnit) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeUnit",
                new Integer(this.timeUnit), new Integer(timeUnit));

        this.timeUnit = timeUnit;

        firePropertyChange(pce);
    }

    /**
     * @return Returns the instrumentId.
     */
    public String getInstrumentId() {
        return instrumentId;
    }

    /**
     * @param instrumentId The instrumentId to set.
     */
    public void setInstrumentId(String instrumentId) {
        this.instrumentId = instrumentId;
    }

    public int getPchGenerationMethod() {
        return pchGenerationMethod;
    }

    public void setPchGenerationMethod(int pchGenerationMethod) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this,
                "pchGenerationMethod", new Integer(this.pchGenerationMethod),
                new Integer(pchGenerationMethod));

        this.pchGenerationMethod = pchGenerationMethod;

        firePropertyChange(pce);
    }

    public int getTransposition() {
        return transposition;
    }

    public void setTransposition(int transposition) {
        this.transposition = transposition;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime,
            double endTime) throws SoundObjectException {

        return generateNotes(startTime, endTime);

    }

    @Override
    public PianoRoll deepCopy() {
        return new PianoRoll(this);
    }
}
