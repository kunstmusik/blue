/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.scripting;

import blue.BlueSystem;
import blue.soundObject.SoundObjectException;
import blue.utilities.ProcessRunner;
import blue.utility.FileUtilities;
import java.io.File;
import java.io.IOException;
import java.util.Map;
import javax.script.ScriptException;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author stevenyi
 */
@ServiceProvider(service = ScoreScriptEngine.class)
public class ExternalScoreEngine implements ScoreScriptEngine {

    @Override
    public String getEngineName() {
        return "External";
    }

    @Override
    public String evalCode(String code, Map<String, Object> initValues) 
            throws ScriptException {

        ProcessRunner processRunner = new ProcessRunner();
        File currentWorkingDirectory = null;

        try {
            // output text from soundObject to a temp file for processing by
            // external program
            File temp = FileUtilities.createTempTextFile("blueTempText",
                    ".txt", BlueSystem.getCurrentProjectDirectory(),
                    code);

            StringBuilder buffer = new StringBuilder();
            String commandLine = (String) initValues.get("commandline");

            currentWorkingDirectory = temp.getParentFile();

            // check if $outfile is used; if so, run the external program
            // set to
            // output to $outfile,
            // then grab text from generated file, of not found, assume
            // program
            // outputs to screen
            // and grab from stdin
            if (!commandLine.contains("$outfile")) {
                commandLine = getPreparedCommandLine(commandLine, temp
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

                commandLine = this.getPreparedCommandLine(commandLine, temp
                        .getName(), outFile.getName());

                System.out.println("Calling command: " + commandLine);
                System.out.println("Using directory: "
                        + currentWorkingDirectory.getAbsolutePath());

                processRunner.execWait(commandLine,
                        currentWorkingDirectory);

                buffer.append(blue.utility.TextUtilities
                        .getTextFromFile(outFile));

            }

            return buffer.toString();
        } catch (Exception ex) {
            throw new ScriptException(ex);
        }
    }

    protected static String getPreparedCommandLine(String commandLine, String inFileName, String outFileName) {
        String temp = getPreparedCommandLine(commandLine, inFileName);
        return blue.utility.TextUtilities
                .replace(temp, "$outfile", outFileName);
    }

    protected static String getPreparedCommandLine(String commandLine, String inFileName) {
        if (!commandLine.contains("$infile")) {
            return commandLine + " " + inFileName;
        } else {
            return blue.utility.TextUtilities.replace(commandLine, "$infile",
                    inFileName);
        }
    }
}
