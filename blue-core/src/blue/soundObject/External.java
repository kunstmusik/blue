package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.utilities.ProcessRunner;
import blue.utility.FileUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.File;
import java.io.IOException;
import java.io.Serializable;
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
public class External extends AbstractSoundObject implements Serializable,
        Cloneable {
//    private static BarRenderer renderer = new LetterRenderer("E");

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private String commandLine = "";

    private String text = "";

    private String syntaxType = "Python";

    public External() {
        this.setName("External");
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
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
    public float getObjectiveDuration() {
        return this.getSubjectiveDuration();
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public final NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {

        if (commandLine.trim().length() == 0 && getText().trim().length() == 0) {
            return null;
        }

        NoteList nl = new NoteList();

        File currentWorkingDirectory = null;

        try {
            // output text from soundObject to a temp file for processing by
            // external program
            File temp = FileUtilities.createTempTextFile("blueTempText",
                    ".txt", BlueSystem.getCurrentProjectDirectory(), this
                            .getText());

            StringBuilder buffer = new StringBuilder();

            currentWorkingDirectory = temp.getParentFile();

            // check if $outfile is used; if so, run the external program set to
            // output to $outfile,
            // then grab text from generated file, of not found, assume program
            // outputs to screen
            // and grab from stdin

            ProcessRunner processRunner = new ProcessRunner();

            if (!this.getCommandLine().contains("$outfile")) {
                String commandLine = this
                        .getPreparedCommandLine(temp.getName());

                System.out.println("Calling command: " + commandLine);
                System.out.println("Using directory: "
                        + currentWorkingDirectory.getAbsolutePath());

                processRunner.execWaitAndCollect(commandLine,
                        currentWorkingDirectory);

                buffer.append(processRunner.getCollectedOutput());

            } else {
                File outFile = File.createTempFile("blueTempOutFile", ".sco",
                        BlueSystem.getCurrentProjectDirectory());
                outFile.deleteOnExit();

                String commandLine = this.getPreparedCommandLine(
                        temp.getName(), outFile.getName());

                System.out.println("Calling command: " + commandLine);
                System.out.println("Using directory: "
                        + currentWorkingDirectory.getAbsolutePath());

                processRunner.execWait(commandLine, currentWorkingDirectory);

                buffer.append(blue.utility.TextUtilities
                        .getTextFromFile(outFile));
            }

            nl = blue.utility.ScoreUtilities.getNotes(buffer.toString());

        } catch (IOException ioe) {
            throw new SoundObjectException(this, getIOExceptionMessage(), ioe);
        } catch (Exception ex) {
            throw new SoundObjectException(this, ex);
        }

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
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

    public String getPreparedCommandLine(String inFileName, String outFileName) {
        String temp = getPreparedCommandLine(inFileName);
        return blue.utility.TextUtilities
                .replace(temp, "$outfile", outFileName);
    }

    public String getPreparedCommandLine(String inFileName) {
        String temp = this.commandLine;

        if (!this.commandLine.contains("$infile")) {
            return this.commandLine + " " + inFileName;
        } else {
            return blue.utility.TextUtilities.replace(temp, "$infile",
                    inFileName);
        }
    }

    /*
     * public String getPreparedCommandLine(String inFileName) {
     * 
     * StringBuffer buffer = new StringBuffer(); StringTokenizer st = new
     * StringTokenizer(this.commandLine); String token; boolean inFileFound =
     * false;
     * 
     * 
     * 
     * while(st.hasMoreTokens()) { token = st.nextToken();
     * if(token.equals("$infile")) { inFileFound = true; token = inFileName; }
     * buffer.append(token + " "); } if(!inFileFound) {
     * buffer.append(inFileName); }
     * 
     * return buffer.toString(); }
     */

    @Override
    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public float getRepeatPoint() {
        return this.repeatPoint;
    }

    @Override
    public void setRepeatPoint(float repeatPoint) {
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
    public NoteList generateForCSD(CompileData compileData, float startTime, 
            float endTime) throws SoundObjectException {
        
        NoteList retVal = generateNotes(startTime, endTime);
        return retVal;
        
    }

}