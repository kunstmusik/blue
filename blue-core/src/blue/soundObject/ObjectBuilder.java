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

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.orchestra.blueSynthBuilder.BSBCompilationUnit;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.PresetGroup;
import blue.scripting.PythonProxy;
import blue.utilities.ProcessRunner;
import blue.utility.FileUtilities;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.File;
import java.io.IOException;
import org.apache.commons.lang.builder.EqualsBuilder;
import org.python.core.PyException;

public class ObjectBuilder extends AbstractSoundObject {
//    private static BarRenderer renderer = new LetterRenderer("O");

    BSBGraphicInterface graphicInterface;

    PresetGroup presetGroup;

    String code;

    String commandLine;

    private boolean editEnabled = true;

    boolean isExternal = false;

    private String syntaxType = "Python";

    // String instrumentText;
    // String globalOrc;
    // String globalSco;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private transient BSBCompilationUnit bsbCompilationUnit;

    public ObjectBuilder() {
        setName("ObjectBuilder");

        graphicInterface = new BSBGraphicInterface();
        presetGroup = new PresetGroup();

        code = "";
        commandLine = "";
        // instrumentText = "";
        // globalOrc = "";
        // globalSco = "";

        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
    }

//    public SoundObjectEditor getEditor() {
//        return new ObjectBuilderEditor();
//    }

    // GENERATION METHODS

    public void generateGlobals(GlobalOrcSco globalOrcSco) {
        doPreCompilation();
    }

    public void generateFTables(Tables tables) {
        // TODO Auto-generated method stub
    }

    public void generateInstruments(Arrangement arr) {
        // TODO Auto-generated method stub
    }

    public NoteList generateNotes(float renderStart, float renderEnd) throws SoundObjectException {
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

                StringBuffer buffer = new StringBuffer();

                currentWorkingDirectory = temp.getParentFile();

                // check if $outfile is used; if so, run the external program
                // set to
                // output to $outfile,
                // then grab text from generated file, of not found, assume
                // program
                // outputs to screen
                // and grab from stdin

                if (this.getCommandLine().indexOf("$outfile") == -1) {
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

        doPostCompilation();
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

        if (this.commandLine.indexOf("$infile") == -1) {
            return this.commandLine + " " + inFileName;
        } else {
            return blue.utility.TextUtilities.replace(temp, "$infile",
                    inFileName);
        }
    }

    private void doPreCompilation() {
        bsbCompilationUnit = new BSBCompilationUnit();
        graphicInterface.setupForCompilation(bsbCompilationUnit);
    }

    private void doPostCompilation() {
        bsbCompilationUnit = null;
    }

    // END GENERATION METHODS

    public float getObjectiveDuration() {
        return getSubjectiveDuration();
    }

//    public BarRenderer getRenderer() {
//        return renderer;
//    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain noteProcessorChain) {
        this.npc = noteProcessorChain;
    }

    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    public float getRepeatPoint() {
        return this.repeatPoint;
    }

    public void setRepeatPoint(float repeatPoint) {
        this.repeatPoint = repeatPoint;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.REPEAT_POINT);

        fireSoundObjectEvent(event);
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            SoundObjectLibrary sObjLibrary) throws Exception {
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

            if (nodeName.equals("code")) {
                bsb.setCode(node.getTextString());
            } else if (nodeName.equals("commandLine")) {
                bsb.setCommandLine(node.getTextString());
            } else if (nodeName.equals("isExternal")) {
                bsb.setExternal(XMLUtilities.readBoolean(node));
            } else if (nodeName.equals("graphicInterface")) {
                bsb.setGraphicInterface(BSBGraphicInterface.loadFromXML(node));
            } else if (nodeName.equals("presetGroup")) {
                bsb.setPresetGroup(PresetGroup.loadFromXML(node));
            } else if (nodeName.equals("syntaxType")) {
                bsb.setSyntaxType(node.getTextString());
            }

        }

        return bsb;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.setAttribute("editEnabled", Boolean.toString(editEnabled));

        retVal.addElement("code").setText(this.getCode());
        retVal.addElement("commandLine").setText(this.getCommandLine());
        retVal.addElement(XMLUtilities.writeBoolean("isExternal", isExternal));

        retVal.addElement(graphicInterface.saveAsXML());
        retVal.addElement(presetGroup.saveAsXML());
        retVal.addElement("syntaxType").setText(this.getSyntaxType());

        return retVal;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
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

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public boolean isEditEnabled() {
        return editEnabled;
    }

    public void setEditEnabled(boolean editEnabled) {
        this.editEnabled = editEnabled;
    }
}
