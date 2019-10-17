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
import blue.services.render.DiskRenderJob;
import blue.services.render.DiskRenderService;
import blue.settings.DiskRenderSettings;
import blue.settings.GeneralSettings;
import blue.ui.core.render.ProcessConsole;
import blue.ui.core.soundFile.AudioFilePlayerTopComponent;
import blue.ui.utilities.FileChooserManager;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.function.Consumer;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import org.netbeans.api.progress.ProgressHandle;
import org.netbeans.api.progress.ProgressHandleFactory;
import org.openide.util.Cancellable;
import org.openide.util.Exceptions;
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

    public void renderToDisk(BlueData data, 
            Consumer<File> completionCallback) {

        if (MainToolBar.getInstance().isRendering()) {
            MainToolBar.getInstance().stopRendering();
        }

        try {

            DiskRenderCommand command = getDiskCommandLine(data);

            if (command == null) { // Signifies Cancel on File Dialog
                return;
            }

//            float startTime = data.getRenderStartTime();
//            float endTime = data.getRenderEndTime();
//
//            if (data.getProjectProperties().diskAlwaysRenderEntireProject) {
//                startTime = 0.0f;
//                endTime = -1.0f;
//            }
//            CsdRenderResult result = CSDRenderService.getDefault().generateCSD(
//                    data, startTime,
//                    endTime, false);
//
//            String csd = result.getCsdText();
//
//            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
//                    BlueSystem.getCurrentProjectDirectory(), csd);
//
//            String playArgs[] = new String[command.args.length + 1];
//            System.arraycopy(command.args, 0, playArgs, 0, command.args.length);
//            playArgs[command.args.length] = "\"" + temp.getAbsolutePath() + "\"";
            DiskRenderJob job = new DiskRenderJob(command.args, command.filename,
                    data, BlueSystem.getCurrentProjectDirectory());

            play(job, completionCallback);
        } catch (Exception ex) {
            ExceptionDialog.showExceptionDialog(WindowManager.getDefault().
                    getMainWindow(),
                    ex);
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
    private DiskRenderCommand getDiskCommandLine(BlueData data) throws IOException {
        String args[];
        String fileOutput;
        ProjectProperties props = data.getProjectProperties();

        if (props.diskCompleteOverride) {
            String command = props.diskAdvancedSettings;

            if (!GeneralSettings.getInstance().isMessageColorsEnabled()) {
                command += " -+msg_color=false ";
            }

            args = command.split("\\s+");

            fileOutput = getFileOutputFromCommand(command);
        } else {

            String fileName = "";

            if (props.askOnRender || props.fileName.trim().length() == 0) {
                File retVal = FileChooserManager.getDefault().showSaveDialog(
                        FILE_CHOOSER_ID,
                        WindowManager.getDefault().getMainWindow());

                if (retVal != null) {
                    fileName = retVal.getCanonicalPath();
                } else {
                    return null;
                }

            } else {
                fileName = props.fileName;
            }

            fileOutput = fileName;

            DiskRenderSettings settings = DiskRenderSettings.getInstance();

            String command = settings.getCommandLine() + " " + getMessageLevelFlag(
                    props) + " " + props.diskAdvancedSettings + " -o"; // \"" + fileName + "\"";
            ArrayList<String> commandList = new ArrayList<>();
            commandList.addAll(Arrays.asList(command.split("\\s+")));
            commandList.add(fileName);
            args = commandList.toArray(new String[0]);
        }
        return new DiskRenderCommand(args, fileOutput);
    }

    public void play(DiskRenderJob job, Consumer<File> completionCallback) {
        RunProxy runProxy = new RunProxy(job, completionCallback);
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

        boolean cancelled = false;
        DiskRenderService diskRenderService;
        DiskRenderJob job;
        private final Consumer<File> completionCallback;

        private RunProxy(DiskRenderJob job, Consumer<File> completionCallback) {
            this.job = job;
            this.completionCallback = completionCallback;
            this.diskRenderService = DiskRenderSettings.getInstance().renderServiceFactory.createInstance();
        }

        @Override
        public boolean cancel() {

            if (diskRenderService.isRunning()) {
                diskRenderService.stop();
            }

            return true;
        }

        @Override
        public void run() {
            ProgressHandle handle = ProgressHandleFactory.createHandle(
                    "Rendering to Disk", this);
            handle.start();
            handle.progress("Rendering...");

            try {
                diskRenderService.renderToDisk(job);

                if (completionCallback != null && !cancelled) {
                    String fileOut = job.getFilename();

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

                    SwingUtilities.invokeLater(()-> completionCallback.accept(f));
                    
                }

            } catch (Exception ioe) {
                diskRenderService.stop();
                Exceptions.printStackTrace(ioe);
            } finally {
                handle.finish();
            }

        }
    }

    private class DiskRenderCommand {

        public String[] args;
        public String filename;

        public DiskRenderCommand(String args[], String filename) {
            this.args = args;
            this.filename = filename;
        }
    }
}
