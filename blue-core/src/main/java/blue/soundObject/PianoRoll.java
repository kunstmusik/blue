package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import blue.soundObject.pianoRoll.PianoNote;
import blue.soundObject.pianoRoll.Scale;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;

/**
 * @author steven yi
 */
@SoundObjectPlugin(displayName = "PianoRoll", live = true, position = 90)
public class PianoRoll extends AbstractSoundObject implements ListChangeListener<FieldDef> {

    public static final int DISPLAY_TIME = 0;

    public static final int DISPLAY_NUMBER = 1;

    public static final int GENERATE_FREQUENCY = 0;

    public static final int GENERATE_PCH = 1;

    public static final int GENERATE_MIDI = 2;

    private TimeBehavior timeBehavior;

    double repeatPoint = 4.0;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private Scale scale;

    private ObservableList<PianoNote> notes;

    private String noteTemplate;

    private String instrumentId;

    private int pixelSecond;

    private int noteHeight;

    private boolean snapEnabled = true;

    private double snapValue = 0.25;

    private int timeDisplay = DISPLAY_NUMBER;

    private int pchGenerationMethod = GENERATE_FREQUENCY;

    private int timeUnit = 4;

    private int transposition = 0;

    private ObservableList<FieldDef> fieldDefinitions;

    private final PropertyChangeSupport pcs = new PropertyChangeSupport(this);

    ChangeListener<? super Number> minListener = (obs, old, newVal) -> {
        for (var fd : fieldDefinitions) {
            if (fd.minValueProperty() == obs) {
                for (var pn : notes) {
                    var field = pn.getField(fd);
                    field.ifPresent(fld -> fld.setValue(Math.max(newVal.doubleValue(), fld.getValue())));
                }
                break;
            }
        }
    };

    ChangeListener<? super Number> maxListener = (obs, old, newVal) -> {
        for (var fd : fieldDefinitions) {
            if (fd.maxValueProperty() == obs) {
                for (var pn : notes) {
                    var field = pn.getField(fd);
                    field.ifPresent(fld -> fld.setValue(Math.min(newVal.doubleValue(), fld.getValue())));
                }
                break;
            }
        }
    };

    ChangeListener<FieldType> fieldTypeListener = (obs, old, newVal) -> {
        for (var fd : fieldDefinitions) {
            if (fd.fieldTypeProperty() == obs) {
                for (var pn : notes) {
                    var field = pn.getField(fd);
                    // will run through FieldDef's convertToFieldType()
                    field.ifPresent(fld -> fld.setValue(fld.getValue()));
                }
                break;
            }
        }
    };

    public PianoRoll() {
        this.setName("PianoRoll");
        timeBehavior = TimeBehavior.REPEAT;
        scale = Scale.get12TET();
        notes = FXCollections.observableArrayList();
        noteTemplate = "i <INSTR_ID> <START> <DUR> <FREQ> <AMP>";
        instrumentId = "1";
        pixelSecond = 64;
        noteHeight = 15;
        fieldDefinitions = FXCollections.observableArrayList();
        fieldDefinitions.addListener(this);

        // By default, add one field called AMP
        var ampField = new FieldDef();
        ampField.setFieldName("AMP");
        ampField.setFieldType(FieldType.CONTINUOUS);
        fieldDefinitions.add(ampField);

    }

    public PianoRoll(PianoRoll pr) {
        super(pr);

        timeBehavior = pr.timeBehavior;
        repeatPoint = pr.repeatPoint;
        npc = new NoteProcessorChain(pr.npc);
        scale = new Scale(pr.scale);

        notes = FXCollections.observableArrayList();

        fieldDefinitions = FXCollections.observableArrayList();
        fieldDefinitions.addListener(this);

        Map<FieldDef, FieldDef> srcToCloneMap = new HashMap<>();

        for (var fieldDef : pr.getFieldDefinitions()) {
            var clone = new FieldDef(fieldDef);
            srcToCloneMap.put(fieldDef, clone);
            fieldDefinitions.add(clone);
        }

        for (PianoNote pn : pr.notes) {
            var newNote = new PianoNote(pn);
            notes.add(newNote);

            // set fieldDef for fields to use the new cloned version
            for (var f : newNote.getFields()) {
                f.setFieldDef(srcToCloneMap.get(f.getFieldDef()));
            }
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
        final String prNoteTemplate = noteTemplate.trim();

        if (instrId != null) {
            instrId = instrId.trim();
        }

        try {
            Integer.parseInt(instrumentId);
        } catch (NumberFormatException nfe) {
            instrId = "\"" + instrId + "\"";
        }

        for (var n : notes) {
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

            switch (this.pchGenerationMethod) {
                case GENERATE_FREQUENCY:
                    double f = scale.getFrequency(octave, scaleDegree);
                    freq = Double.toString(f);
                    break;
                case GENERATE_PCH:
                    freq = octave + "." + scaleDegree;
                    break;
                case GENERATE_MIDI:
                    freq = Integer.toString((octave * 12) + scaleDegree);
                    break;
                default:
                    break;
            }

            String template = n.getNoteTemplate();
            if (template == null) {
                template = prNoteTemplate;
            } else {
                template = template.trim();
            }

            template = TextUtilities
                    .replaceAll(template, "<INSTR_ID>", instrId);
            template = TextUtilities.replaceAll(template, "<INSTR_NAME>",
                    instrumentId);
            template = TextUtilities.replaceAll(template, "<START>", Double
                    .toString(n.getStart()));
            template = TextUtilities.replaceAll(template, "<DUR>", Double
                    .toString(n.getDuration()));
            template = TextUtilities.replaceAll(template, "<FREQ>", freq);

            for (var field : n.getFields()) {
                var fieldDef = field.getFieldDef();
                var k = String.format("<%s>", fieldDef.getFieldName());
                var v = (fieldDef.getFieldType() == FieldType.CONTINUOUS)
                        ? Double.toString(field.getValue())
                        : Long.toString(Math.round(field.getValue()));

                template = TextUtilities.replaceAll(template, k, v);
            }

            Note note = null;

            try {
                note = Note.createNote(template);
            } catch (NoteParseException e) {
                throw new SoundObjectException(this, e);
            }

            nl.add(note);
        }

        nl.sort();

        try {
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
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
        var oldVal = this.timeBehavior;
        this.timeBehavior = timeBehavior;

        pcs.firePropertyChange("timeBehavior", oldVal, timeBehavior);
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
        p.fieldDefinitions.clear();

        SoundObjectUtilities.initBasicFromXML(data, p);

        Elements nodes = data.getElements();

        Map<String, FieldDef> fieldTypes = new HashMap<>();

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
                    p.setSnapEnabled(Boolean.parseBoolean(e.getTextString()));
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
                case "fieldDef": {
                    var fd = FieldDef.loadFromXML(e);
                    fieldTypes.put(fd.getFieldName(), fd);
                    p.fieldDefinitions.add(fd);
                    break;
                }
                case "pianoNote": {
                    // Assumes fieldDefs are loaded prior to pianoNotes
                    var pn = PianoNote.loadFromXML(e, fieldTypes);

                    // legacy: set note noteTemplate to null if found and equals
                    // to PianoRoll's value
                    if (p.getNoteTemplate().equals(pn.getNoteTemplate())) {
                        pn.setNoteTemplate(null);
                    }

                    p.notes.add(pn);
                    break;
                }
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

        for (var fieldDef : fieldDefinitions) {
            retVal.addElement(fieldDef.saveAsXML());
        }

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
        final var newVal = (noteTemplate == null) ? "" : noteTemplate;

        if (!newVal.equals(this.noteTemplate)) {
            var oldVal = this.noteTemplate;
            this.noteTemplate = newVal;
            pcs.firePropertyChange("noteTemplate", oldVal, newVal);
        }
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
        var oldVal = this.scale;
        this.scale = scale;
        pcs.firePropertyChange("scale", oldVal, scale);
    }

    /* PROPERTY CHANGE EVENTS */
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        pcs.addPropertyChangeListener(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        pcs.removePropertyChangeListener(listener);
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
        var oldVal = this.pixelSecond;
        this.pixelSecond = pixelSecond;
        pcs.firePropertyChange("pixelSecond", oldVal, pixelSecond);
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
        var oldVal = this.noteHeight;
        this.noteHeight = noteHeight;
        pcs.firePropertyChange("noteHeight", oldVal, noteHeight);
    }

    /**
     * @return Returns the snapEnabled.
     */
    public boolean isSnapEnabled() {
        return snapEnabled;
    }

    public void setSnapEnabled(boolean snapEnabled) {
        var oldVal = this.snapEnabled;
        this.snapEnabled = snapEnabled;
        pcs.firePropertyChange("snapEnabled", oldVal, snapEnabled);
    }

    public double getSnapValue() {
        return this.snapValue;
    }

    public void setSnapValue(double snapValue) {
        var oldVal = this.snapValue;
        this.snapValue = snapValue;

        pcs.firePropertyChange("snapValue", oldVal, snapValue);
    }

    public int getTimeDisplay() {
        return timeDisplay;
    }

    public void setTimeDisplay(int timeDisplay) {
        var oldVal = this.timeDisplay;
        this.timeDisplay = timeDisplay;
        pcs.firePropertyChange("timeDisplay", oldVal, timeDisplay);
    }

    public int getTimeUnit() {
        return timeUnit;
    }

    public void setTimeUnit(int timeUnit) {
        var oldVal = this.timeUnit;
        this.timeUnit = timeUnit;
        pcs.firePropertyChange("timeUnity", oldVal, timeUnit);
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
        var oldVal = this.instrumentId;
        this.instrumentId = instrumentId;
        pcs.firePropertyChange("instrumentId", oldVal, instrumentId);
    }

    public int getPchGenerationMethod() {
        return pchGenerationMethod;
    }

    public void setPchGenerationMethod(int pchGenerationMethod) {
        var oldVal = this.pchGenerationMethod;
        this.pchGenerationMethod = pchGenerationMethod;
        pcs.firePropertyChange("pchGenerationMethod", oldVal, pchGenerationMethod);
    }

    public int getTransposition() {
        return transposition;
    }

    public void setTransposition(int transposition) {
        var oldVal = this.transposition;
        this.transposition = transposition;
        pcs.firePropertyChange("transposition", oldVal, transposition);
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

    // When there are changes to number of field definitions, ensure that
    // piano notes have field values adjusted
    @Override
    public void onChanged(Change<? extends FieldDef> change) {
        while (change.next()) {
            if (change.wasAdded()) {
                for (var fd : change.getAddedSubList()) {
                    fd.minValueProperty().addListener(minListener);
                    fd.maxValueProperty().addListener(maxListener);
                    fd.fieldTypeProperty().addListener(fieldTypeListener);

                    for (var pn : notes) {
                        pn.getFields().add(new Field(fd));
                    }
                }
            } else if (change.wasRemoved()) {
                for (var fd : change.getRemoved()) {
                    fd.minValueProperty().removeListener(minListener);
                    fd.maxValueProperty().removeListener(maxListener);
                    fd.fieldTypeProperty().removeListener(fieldTypeListener);

                    for (var pn : notes) {
                        pn.getFields().removeIf(field -> field.getFieldDef() == fd);
                    }

                }
            }
        }
    }

    /**
     * Used to check if target PianoRoll is compatible with this PianoRoll for
     * the purpose of copying/pasting note data between the two. Pasted notes
     * should ensure their fields are relinked to FieldDef's in target
     * PianoRoll.
     *
     * @param target
     * @return if target is compatible with this PianoRoll
     */
    public boolean isCompatible(PianoRoll target) {
        if (this == target) {
            return true;
        }
        if (target == null) {
            return false;
        }

        if (!getScale().equals(target.getScale())) {
            return false;
        }

        final var aFieldDefs = getFieldDefinitions();
        final var bFieldDefs = target.getFieldDefinitions();

        if (aFieldDefs.size() != bFieldDefs.size()) {
            return false;
        }

        for (int i = 0; i < aFieldDefs.size(); i++) {
            FieldDef afd = aFieldDefs.get(i);
            FieldDef bfd = bFieldDefs.get(i);

            if (!afd.getFieldName().equals(bfd.getFieldName())
                    || afd.getFieldType() != bfd.getFieldType()
                    || afd.getMinValue() != bfd.getMinValue()
                    || afd.getMaxValue() != bfd.getMaxValue()) {
                return false;
            }
        }
        return true;
    }

}
