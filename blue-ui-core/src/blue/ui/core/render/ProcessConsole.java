/*
 * blue - object composition environment for csound
 * Copyright (c) 2001 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.render;

import blue.BlueData;
import blue.services.render.RenderTimeManager;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.ArrayList;


//import blue.BlueMainFrame;
import blue.BlueSystem;
import blue.automation.Parameter;
import blue.event.PlayModeListener;
import blue.noteProcessor.TempoMapper;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.services.render.DiskRenderJob;
import blue.services.render.DiskRenderService;
import blue.utility.FileUtilities;
import java.awt.Color;
import org.apache.commons.lang3.StringUtils;
import org.openide.util.Exceptions;
import org.openide.windows.IOColors;
import org.openide.windows.IOProvider;
import org.openide.windows.InputOutput;

/**
 * Pulls stderr and stdout out of a process without an independent console.
 * Useful for running "DOS" processes on Windows.
 *
 * @author Copyright (C) 1999 by Michael Gogins. All rights reserved. <ADDRESS>
 * gogins@pipeline.com </ADDRESS>
 *
 * modified by steven yi, 2001-2002
 */
public final class ProcessConsole implements java.io.Serializable, DiskRenderService {
    // private TimeBar timeBar;

    private RenderTimeManager renderTimeManager = null;
    private InputOutput io = null;
    transient OutputThread stdoutThread = null;
    transient OutputThread stderrThread = null;
    transient BufferedReader bufferedReaderStdout = null;
    transient BufferedReader bufferedReaderStderr = null;
    transient public Process process = null;
    String commandLine = null;
    transient PrintWriter stdin = null;
    ArrayList<PlayModeListener> listeners = new ArrayList<PlayModeListener>();
    StringBuffer buffer = null;
    private int lastExitValue = 0;

    public ProcessConsole() {
    }

    @Override
    public String toString() {
        return "Commmandline Runner";
    }

    public void addPlayModeListener(PlayModeListener listener) {
        listeners.add(listener);
    }

    public void removePlayModeListener(PlayModeListener listener) {
        listeners.remove(listener);
    }

    public void notifyPlayModeListeners(int playMode) {
        for (PlayModeListener listener : listeners) {
            listener.playModeChanged(playMode);
        }
    }

    public void execWait(String commandLine, File currentWorkingDirectory)
            throws IOException {
        try {
            exec(commandLine, currentWorkingDirectory, false);
            process.waitFor();
            destroy(true, false);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    private void execWaitAndCollect(String commandLine,
            File currentWorkingDirectory) throws IOException {
        try {
            exec(commandLine, currentWorkingDirectory, true);
            process.waitFor();

            while ((stderrThread != null && stderrThread.isCollecting)
                    || (stdoutThread != null && stdoutThread.isCollecting)) {
                Thread.yield();
                Thread.sleep(50);
            }

            destroy(true, false);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void renderToDisk(DiskRenderJob job) {


        if (this.io != null) {
            try {
                this.io.getOut().reset();
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        try {
            io = IOProvider.getDefault().getIO("Csound (Disk)", false);
            IOColors.setColor(io, IOColors.OutputType.OUTPUT, Color.WHITE);
            io.select();

            String commandLine = StringUtils.join(job.getArgs(), " ");
            BlueData data = job.getData();

            float startTime = data.getRenderStartTime();
            float endTime = data.getRenderEndTime();

            if (data.getProjectProperties().diskAlwaysRenderEntireProject) {
                startTime = 0.0f;
                endTime = -1.0f;
            }

            CsdRenderResult result = CSDRenderService.getDefault().generateCSD(
                    data, startTime,
                    endTime, false);

            String csd = result.getCsdText();

            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                    BlueSystem.getCurrentProjectDirectory(), csd);

            commandLine += " \"" + temp.getAbsolutePath() + "\"";
            //commandLine += " -L stdin";

            execDisk(commandLine, job.getCurrentWorkingDirectory());
            process.waitFor();
            destroy(true, true);

        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static String[] splitCommandString(String in) {
        int mode = 0;

        ArrayList<String> parts = new ArrayList<String>();
        StringBuffer buffer = new StringBuffer();

        for (int i = 0; i < in.length(); i++) {
            char c = in.charAt(i);

            switch (mode) {

                case 0:
                    if (c == '\n' || c == '\t' || c == ' ') {
                        continue;
                    } else if (c == '\"') {
                        // buffer.append(c);
                        mode = 2;
                    } else {
                        buffer.append(c);
                        mode = 1;
                    }
                    break;
                case 1:
                    if (c == '\n' || c == '\t' || c == ' ') {
                        parts.add(buffer.toString());
                        buffer = new StringBuffer();
                        mode = 0;
                    } else {
                        buffer.append(c);
                    }
                    break;
                case 2:

                    if (c == '\"') {
                        parts.add(buffer.toString());
                        buffer = new StringBuffer();
                        mode = 0;
                    } else {
                        buffer.append(c);
                    }
                    break;

            }
        }

        if (buffer.length() != 0) {
            parts.add(buffer.toString());
        }

        String[] retVal = new String[parts.size()];

        for (int i = 0; i < parts.size(); i++) {
            retVal[i] = parts.get(i);
        }

        return retVal;
    }

    private void exec(String commandLine, File currentWorkingdirectory,
            boolean collecting) throws IOException {
        destroy(false);

        if (collecting) {
            buffer = new StringBuffer();
        } else {
            buffer = null;
        }

        if (this.io != null) {
            try {
                this.io.getOut().reset();
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        io = IOProvider.getDefault().getIO("Csound", false);
        IOColors.setColor(io, IOColors.OutputType.OUTPUT, Color.WHITE);

        io.getOut().append("[CommandlineRunner] - ").append(
                BlueSystem.getString("processConsole.start") + "("
                + commandLine + ").").append("\n");
        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_PLAY);

        this.commandLine = commandLine;

        if (System.getProperty("os.name").indexOf("Windows") >= 0) {
            process = Runtime.getRuntime().exec(commandLine, null,
                    currentWorkingdirectory);
        } else {

            this.commandLine += " -L stdin";

            String[] cmdArray = splitCommandString(this.commandLine);

            process = Runtime.getRuntime().exec(cmdArray, null,
                    currentWorkingdirectory);
        }

        bufferedReaderStderr = new BufferedReader(new InputStreamReader(process
                .getErrorStream()));
        stderrThread = new OutputThread(bufferedReaderStderr);

        bufferedReaderStdout = new BufferedReader(new InputStreamReader(process
                .getInputStream()));
        stdoutThread = new OutputThread(bufferedReaderStdout);

        stderrThread.start();
        stdoutThread.start();

        stdin = new PrintWriter(this.process.getOutputStream());
    }

    private void execDisk(String commandLine, File currentWorkingdirectory)
            throws IOException {
        destroy(false);


        io.getOut().append("[CommandlineRunner] - ").append(
                BlueSystem.getString("processConsole.start") + "("
                + commandLine + ").").append("\n");

        this.commandLine = commandLine;

        if (System.getProperty("os.name").indexOf("Windows") >= 0) {
            process = Runtime.getRuntime().exec(commandLine, null,
                    currentWorkingdirectory);
        } else {
            String[] cmdArray = splitCommandString(this.commandLine);

            process = Runtime.getRuntime().exec(cmdArray, null,
                    currentWorkingdirectory);
        }

        bufferedReaderStderr = new BufferedReader(new InputStreamReader(process
                .getErrorStream()));
        stderrThread = new OutputThread(bufferedReaderStderr);

        bufferedReaderStdout = new BufferedReader(new InputStreamReader(process
                .getInputStream()));
        stdoutThread = new OutputThread(bufferedReaderStdout);

        stderrThread.start();
        stdoutThread.start();

        stdin = new PrintWriter(this.process.getOutputStream());
    }

    @Override
    public boolean isRunning() {
        return (process != null);
    }

    @Override
    public void stop() {
        if (isRunning()) {
            destroy(false, true);
        }
    }

    public void destroy(boolean notifyListeners) {
        destroy(notifyListeners, true);
    }

    public void destroy(boolean notifyListeners, boolean killProcess) {

        if (killProcess) {

            if (System.getProperty("os.name").indexOf("Windows") >= 0) {

                try {
                    if (stderrThread != null) {
                        stderrThread.killThread = true;
                        // stderrThread.stop ();
                    }
                } catch (Exception x) {
                }

                try {
                    if (stdoutThread != null) {
                        stdoutThread.killThread = true;
                        // stdoutThread.stop ();
                    }
                } catch (Exception x) {
                }

                try {
                    if (process != null) {
                        process.destroy();
                    }
                } catch (Exception x) {
                    x.printStackTrace();
                }
            } else {
                try {
                    if (process != null) {
                        passToStdin("e");
                        process.waitFor();
                    }
                } catch (Exception x) {
                    x.printStackTrace();
                }
            }
        } else if (process != null) {
            try {
                process.waitFor();
            } catch (InterruptedException ie) {
                ie.printStackTrace();
            }
        }

        if (process != null) {
            try {
                setLastExitValue(process.exitValue());
            } catch (IllegalThreadStateException itse) {
                // itse.printStackTrace();
                setLastExitValue(0); // FIXME - not sure this is the right
                // thing to do
            }
        }

        stderrThread = null;
        stdoutThread = null;
        process = null;
        stdin = null;

        if (commandLine != null) {

            io.getOut().append(BlueSystem.getString("processConsole.stop")
                    + "(" + commandLine + ").").append("\n");
        }

        commandLine = null;

        if (notifyListeners) {
            if (renderTimeManager != null) {
                renderTimeManager.endRender();
            }

            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
        }
    }

    public void passToStdin(String text) {
        if (this.stdin != null) {
            stdin.print(text + "\n");
            stdin.flush();
        }
    }

    public String getCollectedOutput() {
        if (buffer == null) {
            return null;
        }

        return buffer.toString();
    }

    // TODO - finish implementing!
    @Override
    public void execWait(String[] args, File currentWorkingDirectory, float startTime, TempoMapper mapper, ArrayList<Parameter> parameters) {
        throw new UnsupportedOperationException("Not supported yet."); //To change body of generated methods, choose Tools | Templates.
    }

    @Override
    public String execWaitAndCollect(String[] args, File currentWorkingDirectory) {
        String command = StringUtils.join(args, " ");
        try {
            execWaitAndCollect(command, currentWorkingDirectory);
        } catch (IOException ex) {
            return null;
        }
        return getCollectedOutput();
    }

    @Override
    public int getCsoundVersion(String csoundCommand) {
        // Csound version 6.00.1 (double samples) Aug 18 2013
        String val = execWaitAndCollect(new String[]{csoundCommand}, null);
        String lines[] = val.split("\\r?\\n");
        for (String line : lines) {
            if (line.trim().startsWith("Csound version")) {
                String parts[] = line.split("\\s+");
                try {
                    return Integer.parseInt("" + parts[2].charAt(0));
                } catch (NumberFormatException nfe) {
                    return -1;
                }
            }
        }
        return -1;
    }

    public class OutputThread extends Thread {

        BufferedReader reader = null;
        volatile boolean killThread = false;
        public boolean isCollecting = true;

        OutputThread(BufferedReader reader) {
            this.reader = reader;
        }

        public void run() {
            float time;

            try {
                String line = null;

                int counter = 100;

                while ((line = reader.readLine()) != null && counter >= 0) {
                    if (killThread) {
                        counter--;
                    }

                    if (line.startsWith("blueTimePointer")) {
                        time = Float.parseFloat(line.substring(line
                                .indexOf("=") + 1));

                        if (renderTimeManager != null) {
                            renderTimeManager.updateTimePointer(time);
                            // System.out.println("Time pointer found: " +
                            // time);
                        }

                    } else if (buffer != null) {
                        buffer.append(line).append("\n");
                    } else if (io == null) {
                        System.out.println(line);
                        System.out.flush();
                    } else {
                        io.getOut().append(line).append("\n");
                    }

                    yield();
                }

            } catch (IOException e) {
                // e.printStackTrace ();
            } catch (NullPointerException npe) {
                // eat it
            }

            isCollecting = false;
        }
    }

    /**
     * @param bar
     */
    public void setRenderTimeManager(RenderTimeManager renderTimeManager) {
        this.renderTimeManager = renderTimeManager;
    }

    private void setLastExitValue(int lastExitValue) {
        this.lastExitValue = lastExitValue;
    }

    public int getLastExitValue() {
        return lastExitValue;
    }
}