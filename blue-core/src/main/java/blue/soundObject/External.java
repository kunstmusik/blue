package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.scripting.ScoreScriptEngine;
import blue.scripting.ScoreScriptEngineManager;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.HashMap;
import java.util.Map;

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
 * @author unascribed
 * @version 1.0
 */

@SoundObjectPlugin(displayName = "External", live=true, position = 30)
public class External extends AbstractSoundObject {
//    private static BarRenderer renderer = new LetterRenderer("E");

    private NoteProcessorChain npc; 

    private TimeBehavior timeBehavior;

    double repeatPoint = -1.0f;

    private String commandLine = "";

    private String text = "";

    private String syntaxType = "Python";

    public External() {
        this.setName("External");
        npc = new NoteProcessorChain();
        timeBehavior = TimeBehavior.SCALE;
    }

    public External(External external) {
        super(external);
        timeBehavior = external.timeBehavior;
        npc = new NoteProcessorChain(external.getNoteProcessorChain());
        repeatPoint = external.repeatPoint;
        commandLine = external.commandLine;
        text = external.text;
        syntaxType = external.syntaxType;
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return this.npc;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain noteProcessorChain) {
        this.npc = noteProcessorChain;
    }

    @Override
    public double getObjectiveDuration() {
        return this.getSubjectiveDuration();
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public final NoteList generateNotes(double renderStart, double renderEnd) throws SoundObjectException {

        if (commandLine.trim().length() == 0 && getText().trim().length() == 0) {
            return null;
        }

        NoteList nl = new NoteList();

        ScoreScriptEngine engine
                = ScoreScriptEngineManager.getInstance().getEngine("External");
        Map<String, Object> initVals = new HashMap<>();
        initVals.put("commandline", this.commandLine);

        try {
            String temp = engine.evalCode(this.text, initVals);
            
            nl = blue.utility.ScoreUtilities.getNotes(temp);
        } catch (Exception ex) {
            throw new SoundObjectException(this, getIOExceptionMessage(), ex);
        }

        try {
            nl = ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException npe) {
            throw new SoundObjectException(this, npe);
        }

        ScoreUtilities.applyTimeBehavior(nl, this.getTimeBehavior(), this
                .getSubjectiveDuration(), this.getRepeatPoint());

        ScoreUtilities.setScoreStart(nl, this.getStartTime());

        return nl;
    }

    private String getIOExceptionMessage() {
        System.out
                .println("[Error] Score Generation failed in External soundObject labeled "
                        + this.getName());
        // String errorMessage =
        // "There was an score generation error in the soundObject:\n\n";
        // errorMessage += "Name: "
        // + this.getName()
        // + " start time: "
        // + this.getStartTime();

        String errorMessage = "External SoundObject Score Generation Error";

        errorMessage += "\n\nUnable to execute the command: "
                + this.commandLine;
        errorMessage += "\n\nPlease check that the command is either in your path\n";
        errorMessage += "or that the absolute path specified is correct.";
        // JOptionPane.showMessageDialog(
        // null,
        // errorMessage,
        // "External SoundObject Score Generation Error",
        // JOptionPane.ERROR_MESSAGE);

        return errorMessage;

    }

    public String getCommandLine() {
        return commandLine;
    }

    public void setCommandLine(String commandLine) {
        this.commandLine = commandLine;
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

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        External external = new External();

        SoundObjectUtilities.initBasicFromXML(data, external);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "text":
                    external.setText(node.getTextString());
                    break;
                case "commandLine":
                    external.setCommandLine(node.getTextString());
                    break;
                case "syntaxType":
                    external.setSyntaxType(node.getTextString());
                    break;
            }
        }

        return external;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("text").setText(this.getText());
        retVal.addElement("commandLine").setText(this.getCommandLine());
        retVal.addElement("syntaxType").setText(this.getSyntaxType());

        return retVal;
    }

    public String getSyntaxType() {
        return syntaxType;
    }

    public void setSyntaxType(String syntaxType) {
        this.syntaxType = syntaxType;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime, 
            double endTime) throws SoundObjectException {
        
        NoteList retVal = generateNotes(startTime, endTime);
        return retVal;
        
    }

    @Override
    public External deepCopy() {
        return new External(this);
    }

}