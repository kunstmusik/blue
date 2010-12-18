/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.BlueSystem;
import blue.MainToolBar;
import blue.ProjectProperties;
import blue.gui.ExceptionDialog;
import blue.settings.DiskRenderSettings;
import blue.settings.GeneralSettings;
import blue.soundObject.SoundObjectException;
import blue.ui.core.render.CSDRender;
import blue.ui.core.render.CsdRenderResult;
import blue.ui.core.render.ProcessConsole;
import blue.ui.core.soundFile.AudioFilePlayerTopComponent;
import blue.ui.utilities.FileChooserManager;
import blue.utility.FileUtilities;
import java.io.File;
import java.io.IOException;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import org.netbeans.api.progress.ProgressHandle;
import org.netbeans.api.progress.ProgressHandleFactory;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Cancellable;
import org.openide.windows.WindowManager;

/**
 *
 * @author syi
 */
public class RenderToDiskUtility {

    private static final String FILE_CHOOSER_ID = "renderToDiskDialog";

    private static RenderToDiskUtility instance = null;

    private RenderToDiskUtility() {
    }

    public static RenderToDiskUtility getInstance() {
        if (instance == null) {
            instance = new RenderToDiskUtility();
        }
        return instance;
    }

    public void renderToDisk(BlueData data, boolean playAfterRender) {

//        if (renderToDiskDialog == null) {
//            renderToDiskDialog = new RenderToDiskDialog(
//                    WindowManager.getDefault().getMainWindow());
//            renderToDiskDialog.setRenderDialogListener(new RenderDialogListener() {
//
//                public void renderFinished() {
//                    if (playAfterRender) {
//                        String fileOut = renderToDiskDialog.getFileOutputName();
//
//                        if (fileOut == null) {
//                            JOptionPane.showMessageDialog(
//                                    WindowManager.getDefault().getMainWindow(),
//                                    "Could not parse file name from command line");
//                            return;
//                        }
//
//                        final File f = BlueSystem.findFile(fileOut);
//
//                        if (f == null) {
//                            JOptionPane.showMessageDialog(
//                                    WindowManager.getDefault().getMainWindow(),
//                                    "Could not find generated file: " + fileOut);
//                            return;
//                        }
//
//                        DiskRenderSettings settings = DiskRenderSettings.
//                                getInstance();
//
//                        if (settings.externalPlayCommandEnabled) {
//                            String command = settings.externalPlayCommand;
//                            command = command.replaceAll("\\$outfile",
//                                    f.getAbsolutePath());
//
//                            try {
//
//                                if (System.getProperty("os.name").indexOf(
//                                        "Windows") >= 0) {
//                                    Runtime.getRuntime().exec(command);
//                                } else {
//                                    String[] cmdArray = ProcessConsole.
//                                            splitCommandString(command);
//                                    Runtime.getRuntime().exec(cmdArray);
//                                }
//
//                                System.out.println(command);
//                            } catch (Exception e) {
//                                JOptionPane.showMessageDialog(
//                                        WindowManager.getDefault().getMainWindow(),
//                                        "Could not run command: " + command,
//                                        "Error",
//                                        JOptionPane.ERROR_MESSAGE);
//                                System.err.println("[" + BlueSystem.getString(
//                                        "message.error") + "] - " + e.
//                                        getLocalizedMessage());
//                                e.printStackTrace();
//                            }
//                        } else {
//                            SwingUtilities.invokeLater(
//                                new Runnable() {
//
//                                    public void run() {
//                                        AudioFilePlayerTopComponent.getDefault().
//                                                setAudioFile(f);
//                                    }
//                                });
//                        }
//                    }
//                }
//            });
//        }

        if (MainToolBar.getInstance().isRendering()) {
            MainToolBar.getInstance().stopRendering();
        }

        try {

            String[] command = getDiskCommandLine(data);

            if (command == null) { // Signifies Cancel on File Dialog
                return;
            }

            float startTime = data.getRenderStartTime();
            float endTime = data.getRenderEndTime();

            if (data.getProjectProperties().diskAlwaysRenderEntireProject) {
                startTime = 0.0f;
                endTime = -1.0f;
            }

            CsdRenderResult result = CSDRender.generateCSD(data, startTime,
                    endTime, false);

            String csd = result.getCsdText();

            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                    BlueSystem.getCurrentProjectDirectory(), csd);

            command[0] += " \"" + temp.getAbsolutePath() + "\"";

            play(command[0], BlueSystem.getCurrentProjectDirectory(),
                    playAfterRender, command[1]);
            // console.execWaitForDisk(command,
            // BlueSystem.getCurrentProjectDirectory());
        } catch (SoundObjectException soe) {
            ExceptionDialog.showExceptionDialog(WindowManager.getDefault().
                    getMainWindow(),
                    soe);
        } catch (Exception ex) {
            StatusDisplayer.getDefault().setStatusText("[" + BlueSystem.
                    getString("message.error") + "] " + BlueSystem.getString(
                    "message.generateScore.error"));
            System.err.println("[" + BlueSystem.getString("message.error") + "] " + ex.
                    getLocalizedMessage());
        }
    }

    /**
     *
     * Gets the disk commandline, asking for file output if necessary
     *
     * SIDE EFFECT: also sets property for dialog for what the outputted file
     * was, to be used by clients of the dialog
     *
     * @param data
     * @return
     * @throws IOException
     */
    private String[] getDiskCommandLine(BlueData data) throws IOException {
        String command;
        String fileOutput;
        ProjectProperties props = data.getProjectProperties();

        if (props.diskCompleteOverride) {
            command = props.diskAdvancedSettings;

            if (!GeneralSettings.getInstance().isMessageColorsEnabled()) {
                command += " -+msg_color=false ";
            }

            fileOutput = getFileOutputFromCommand(command);
        } else {

            String fileName = "";

            if (props.askOnRender || props.fileName.trim().length() == 0) {
                int retVal = FileChooserManager.getDefault().showSaveDialog(
                        FILE_CHOOSER_ID,
                        WindowManager.getDefault().getMainWindow());

                if (retVal == JFileChooser.APPROVE_OPTION) {
                    File f = FileChooserManager.getDefault().getSelectedFile(
                            FILE_CHOOSER_ID);

                    fileName = f.getCanonicalPath();
                } else {
                    return null;
                }

            } else {
                fileName = props.fileName;
            }

            fileOutput = fileName;

            DiskRenderSettings settings = DiskRenderSettings.getInstance();

            command = settings.getCommandLine() + " " + getMessageLevelFlag(
                    props) + " " + props.diskAdvancedSettings + " -o \"" + fileName + "\"";

        }
        return new String[]{command, fileOutput};
    }

    public void play(String command, File currentWorkingDirectory,
            boolean playAfterRender, String outputFileName) {

        RunProxy runProxy = new RunProxy(command, currentWorkingDirectory,
                playAfterRender, outputFileName);
        new Thread(runProxy).start();

    }

    protected static String getFileOutputFromCommand(String command) {
        String[] parts = command.split(" ");

        for (int i = 0; i < parts.length; i++) {
            String part = parts[i].toLowerCase();

            if (part.endsWith(".wav") || part.endsWith(".aiff") || part.endsWith(
                    ".aif")) {
                if (parts[i].charAt(0) == '-') {
                    return parts[i].substring(parts[i].indexOf("o") + 1);
                }
                return parts[i];
            }
        }

        return null;
    }

    private String getMessageLevelFlag(ProjectProperties props) {
        int val = 0;

        if (props.diskNoteAmpsEnabled) {
            val += 1;
        }

        if (props.diskOutOfRangeEnabled) {
            val += 2;
        }

        if (props.diskWarningsEnabled) {
            val += 4;
        }

        if (props.diskBenchmarkEnabled) {
            val += 128;
        }

        return "-m" + val;

    }

    class RunProxy implements Runnable, Cancellable {

        String command;

        File currentWorkingDirectory;

        private final boolean playAfterRender;

        private final String outputFileName;

        boolean cancelled = false;

        private ProcessConsole console = new ProcessConsole();

        private RunProxy(String command, File currentWorkingDirectory,
                boolean playAfterRender, String outputFileName) {
            this.command = command;
            this.currentWorkingDirectory = currentWorkingDirectory;
            this.playAfterRender = playAfterRender;
            this.outputFileName = outputFileName;
        }

        public boolean cancel() {
            if (console.isRunning()) {
                console.destroy(false);
            }

            return true;
        }

        public void run() {
            ProgressHandle handle = ProgressHandleFactory.createHandle(
                    "Rendering to Disk", this);
            handle.start();
            handle.progress("Rendering...");

            try {
                console.execWaitForDisk(command, currentWorkingDirectory);
            } catch (java.io.IOException ioe) {
                console.destroy(false);
                System.err.println("[error] - " + ioe.getLocalizedMessage());
            }

            if (playAfterRender && !cancelled) {
                String fileOut = outputFileName;

                if (fileOut == null) {
                    JOptionPane.showMessageDialog(
                            WindowManager.getDefault().getMainWindow(),
                            "Could not parse file name from command line");
                    return;
                }

                final File f = BlueSystem.findFile(fileOut);

                if (f == null) {
                    JOptionPane.showMessageDialog(
                            WindowManager.getDefault().getMainWindow(),
                            "Could not find generated file: " + fileOut);
                    return;
                }

                DiskRenderSettings settings = DiskRenderSettings.getInstance();

                if (settings.externalPlayCommandEnabled) {
                    String command = settings.externalPlayCommand;
                    command = command.replaceAll("\\$outfile",
                            f.getAbsolutePath());

                    try {

                        if (System.getProperty("os.name").indexOf(
                                "Windows") >= 0) {
                            Runtime.getRuntime().exec(command);
                        } else {
                            String[] cmdArray = ProcessConsole.
                                    splitCommandString(command);
                            Runtime.getRuntime().exec(cmdArray);
                        }

                        System.out.println(command);
                    } catch (Exception e) {
                        JOptionPane.showMessageDialog(
                                WindowManager.getDefault().getMainWindow(),
                                "Could not run command: " + command,
                                "Error",
                                JOptionPane.ERROR_MESSAGE);
                        System.err.println("[" + BlueSystem.getString(
                                "message.error") + "] - " + e.
                                getLocalizedMessage());
                        e.printStackTrace();
                    }
                } else {
                    SwingUtilities.invokeLater(
                            new Runnable() {

                                public void run() {
                                    AudioFilePlayerTopComponent.getDefault().
                                            setAudioFile(f);
                                }
                            });
                }
            }

            handle.finish();
        }
    }
}
