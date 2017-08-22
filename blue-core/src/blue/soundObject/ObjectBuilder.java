/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.orchestra.blueSynthBuilder.BSBCompilationUnit;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.plugin.SoundObjectPlugin;
import blue.scripting.PythonProxy;
import blue.utilities.ProcessRunner;
import blue.utility.FileUtilities;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.File;
import java.io.IOException;
import java.util.Map;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.python.core.PyException;

@SoundObjectPlugin(displayName = "ObjectBuilder", live = true, position = 70)
public class ObjectBuilder extends AbstractSoundObject {

    BSBGraphicInterface graphicInterface;
    PresetGroup presetGroup;
    String code;
    String commandLine;
    private boolean editEnabled = true;
    boolean isExternal = false;
    private String syntaxType = "Python";
    private NoteProcessorChain npc = new NoteProcessorChain();
    private int timeBehavior;
    double repeatPoint = -1.0f;
    StringProperty comment;

    public ObjectBuilder() {
        setName("ObjectBuilder");
        graphicInterface = new BSBGraphicInterface();
        presetGroup = new PresetGroup();
        code = "";
        commandLine = "";
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
        comment = new SimpleStringProperty("");
    }

    public ObjectBuilder(ObjectBuilder objBuilder) {
        super(objBuilder);
        graphicInterface = new BSBGraphicInterface(objBuilder.graphicInterface);
        presetGroup = new PresetGroup(objBuilder.presetGroup);
        code = objBuilder.code;
        commandLine = objBuilder.commandLine;
        timeBehavior = objBuilder.timeBehavior;
        editEnabled = objBuilder.editEnabled;
        isExternal = objBuilder.isExternal;
        repeatPoint = objBuilder.repeatPoint;
        syntaxType = objBuilder.syntaxType;
        npc = new NoteProcessorChain(objBuilder.npc);
        comment = new SimpleStringProperty(objBuilder.getComment());
    }

    // GENERATION METHODS
    public NoteList generateNotes(BSBCompilationUnit bsbCompilationUnit, double renderStart, double renderEnd) throws SoundObjectException {
        String codeToRun = bsbCompilationUnit.replaceBSBValues(code);

        String tempScore = null;
        NoteList nl;

        ProcessRunner processRunner = new ProcessRunner();

        if (isExternal) {
            File currentWorkingDirectory = null;

            try {
                // output text from soundObject to a temp file for processing by
                // external program
                File temp = FileUtilities.createTempTextFile("blueTempText",
                        ".txt", BlueSystem.getCurrentProjectDirectory(),
                        codeToRun);

                StringBuilder buffer = new StringBuilder();

                currentWorkingDirectory = temp.getParentFile();

                // check if $outfile is used; if so, run the external program
                // set to
                // output to $outfile,
                // then grab text from generated file, of not found, assume
                // program
                // outputs to screen
                // and grab from stdin
                if (!this.getCommandLine().contains("$outfile")) {
                    String commandLine = this.getPreparedCommandLine(temp
                            .getName());

                    System.out.println("Calling command: " + commandLine);
                    System.out.println("Using directory: "
                            + currentWorkingDirectory.getAbsolutePath());

                    processRunner.execWaitAndCollect(commandLine,
                            currentWorkingDirectory);

                    buffer.append(processRunner.getCollectedOutput());

                } else {
                    File outFile = File.createTempFile("blueTempOutFile",
                            ".sco", BlueSystem.getCurrentProjectDirectory());
                    outFile.deleteOnExit();

                    String commandLine = this.getPreparedCommandLine(temp
                            .getName(), outFile.getName());

                    System.out.println("Calling command: " + commandLine);
                    System.out.println("Using directory: "
                            + currentWorkingDirectory.getAbsolutePath());

                    processRunner.execWaitAndCollect(commandLine,
                            currentWorkingDirectory);

                    buffer.append(blue.utility.TextUtilities
                            .getTextFromFile(outFile));

                }

                tempScore = buffer.toString();

            } catch (IOException ioe) {
                throw new SoundObjectException(this, getIOExceptionMessage(),
                        ioe);
            } catch (Exception ex) {
                throw new SoundObjectException(this, ex);
            }
        } else {
            try {
                tempScore = PythonProxy.processPythonScore(codeToRun,
                        subjectiveDuration);
            } catch (PyException pyEx) {
                String msg = "ObjectBuilder: Jython Error:\n" + pyEx.toString();
                throw new SoundObjectException(this, msg);
            }
        }

        try {
            nl = ScoreUtilities.getNotes(tempScore);
        } catch (NoteParseException e) {
            throw new SoundObjectException(this, e);
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

    private String getIOExceptionMessage() {
        System.out
                .println("[Error] Score Generation failed in ObjectBuilder soundObject labeled "
                        + this.getName());

        String errorMessage = "ObjectBuilder SoundObject Score Generation Error";

        errorMessage += "\n\nUnable to execute the command: "
                + this.commandLine;
        errorMessage += "\n\nPlease check that the command is either in your path\n";
        errorMessage += "or that the absolute path specified is correct.";

        return errorMessage;

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

    // END GENERATION METHODS
    @Override
    public double getObjectiveDuration() {
        return getSubjectiveDuration();
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }
    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain noteProcessorChain) {
        this.npc = noteProcessorChain;
    }

    @Override
    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
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

    public final void setComment(String value) {
        comment.set(value);
    }

    public final String getComment() {
        return comment.get();
    }

    public final StringProperty commentProperty() {
        return comment;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        ObjectBuilder bsb = new ObjectBuilder();

        SoundObjectUtilities.initBasicFromXML(data, bsb);

        String editEnabledStr = data.getAttributeValue("editEnabled");
        if (editEnabledStr != null) {
            bsb.setEditEnabled(Boolean.valueOf(editEnabledStr).booleanValue());
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "code":
                    bsb.setCode(node.getTextString());
                    break;
                case "commandLine":
                    bsb.setCommandLine(node.getTextString());
                    break;
                case "isExternal":
                    bsb.setExternal(XMLUtilities.readBoolean(node));
                    break;
                case "graphicInterface":
                    bsb.setGraphicInterface(BSBGraphicInterface.loadFromXML(node));
                    break;
                case "presetGroup":
                    bsb.setPresetGroup(PresetGroup.loadFromXML(node));
                    break;
                case "syntaxType":
                    bsb.setSyntaxType(node.getTextString());
                    break;
                case "comment":
                    bsb.setComment(node.getTextString());
                    break;
            }

        }

        return bsb;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.setAttribute("editEnabled", Boolean.toString(editEnabled));

        retVal.addElement("code").setText(this.getCode());
        retVal.addElement("commandLine").setText(this.getCommandLine());
        retVal.addElement(XMLUtilities.writeBoolean("isExternal", isExternal));

        retVal.addElement(graphicInterface.saveAsXML());
        retVal.addElement(presetGroup.saveAsXML());
        retVal.addElement("syntaxType").setText(this.getSyntaxType());
        retVal.addElement("comment").setText(getComment());

        return retVal;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = (code == null) ? "" : code;
    }

    public String getCommandLine() {
        return commandLine;
    }

    public void setCommandLine(String commandLine) {
        this.commandLine = commandLine;
    }

    public boolean isExternal() {
        return isExternal;
    }

    public void setExternal(boolean isExternal) {
        this.isExternal = isExternal;
    }

    public BSBGraphicInterface getGraphicInterface() {
        return graphicInterface;
    }

    public void setGraphicInterface(BSBGraphicInterface graphicInterface) {
        this.graphicInterface = graphicInterface;
    }

    public PresetGroup getPresetGroup() {
        return presetGroup;
    }

    public void setPresetGroup(PresetGroup presetGroup) {
        this.presetGroup = presetGroup;
    }

    public String getSyntaxType() {
        return syntaxType;
    }

    public void setSyntaxType(String syntaxType) {
        this.syntaxType = syntaxType;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public boolean isEditEnabled() {
        return editEnabled;
    }

    public void setEditEnabled(boolean editEnabled) {
        this.editEnabled = editEnabled;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime,
            double endTime) throws SoundObjectException {
        BSBCompilationUnit bsbCompilationUnit = new BSBCompilationUnit();
        graphicInterface.setupForCompilation(bsbCompilationUnit);

        NoteList nl = generateNotes(bsbCompilationUnit, startTime, endTime);
        return nl;

    }

    @Override
    public ObjectBuilder deepCopy() {
        return new ObjectBuilder(this);
    }
}
