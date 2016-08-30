package blue.ui.core.render;

import blue.BlueData;
import blue.BlueSystem;
import blue.LiveData;
import blue.event.PlayModeListener;
import blue.score.ScoreGenerationException;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.services.render.CsoundBinding;
import blue.services.render.RealtimeRenderService;
import blue.services.render.RenderTimeManager;
import blue.settings.GeneralSettings;
import blue.settings.ProjectPropertiesUtil;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.SoundObjectException;
import blue.utility.FileUtilities;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;
import java.awt.BorderLayout;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import org.openide.awt.NotificationDisplayer;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.util.lookup.ServiceProvider;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author
 * @version 1.0
 */
@ServiceProvider(service = RealtimeRenderService.class, position = 500)
public class CommandlineRunner implements PlayModeListener, RealtimeRenderService {

    ProcessConsole console = new ProcessConsole();
    RunProxy runProxy;
    ArrayList<PlayModeListener> listeners = new ArrayList<>();
    private BlueData data = null;
    private boolean shouldStop = false;
    JCheckBox disableMessagesBox = null;
    JPanel errorPanel = null;

    public CommandlineRunner() {
        console.addPlayModeListener(this);
    }

    @Override
    public String toString() {
        return "Commmandline Runner";
    }

    @Override
    public void addPlayModeListener(PlayModeListener listener) {
        listeners.add(listener);
    }

    @Override
    public void removePlayModeListener(PlayModeListener listener) {
        listeners.remove(listener);
    }

    protected void notifyPlayModeListeners(int playMode) {
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PlayModeListener listener = (PlayModeListener) iter.next();
            listener.playModeChanged(playMode);
        }
    }

    /* RENDER METHODS */
    @Override
    public void setData(BlueData data) {
        this.data = data;
    }

    @Override
    public void render() throws SoundObjectException {
        if (this.data == null) {
            return;
        }

        shouldStop = false;

        String command;

        try {

            // String osName = System.getProperty("os.name");
            command = ProjectPropertiesUtil.getRealtimeCommandLine(
                    data.getProjectProperties());

            // if (command.trim().length() == 0) {
            // command = ProgramOptions.getDefaultCommandline();
            // JOptionPane.showMessageDialog(null, BlueSystem
            // .getString("message.noCommandLineSet")
            // + " " + command);
            //
            // }
            String globalSco = data.getGlobalOrcSco().getGlobalSco();
            globalSco = TextUtilities.stripMultiLineComments(globalSco);
            globalSco = TextUtilities.stripSingleLineComments(globalSco);

//            System.out.println(tempoMapper);
            // FIXME
//            timeManager.setRootPolyObject(data.getPolyObject());
            float startTime = data.getRenderStartTime();
            float endTime = data.getRenderEndTime();

            CsdRenderResult result = CSDRenderService.getDefault()
                    .generateCSD(data, startTime, endTime, true, false);

            RenderTimeManager timeManager = Lookup.getDefault().lookup(
                    RenderTimeManager.class);
            timeManager.setTempoMapper(result.getTempoMapper());

            String csd = result.getCsdText();

            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                    BlueSystem.getCurrentProjectDirectory(), csd);

            // if (osName.indexOf("Windows") >= 0) {
            command += " \"" + temp.getAbsolutePath() + "\"";
            // } else {
            // command += " " + temp.getAbsolutePath().replaceAll(" ", "\\\\ ");
            // }

            play(command, BlueSystem.getCurrentProjectDirectory(), data
                    .getRenderStartTime());
        } catch (SoundObjectException soe) {
            throw soe;
        } catch (ScoreGenerationException ex) {
            NotificationDisplayer.getDefault().notify("Error", 
                        NotificationDisplayer.Priority.HIGH.getIcon(), 
                        BlueSystem.getString("message.generateScore.error") + "\n" +
                        ex.getLocalizedMessage(),
                        null);
            System.err.println("[" + BlueSystem.getString("message.error")
                    + "] " + ex.getLocalizedMessage());
        }
    }

    @Override
    public void renderForBlueLive() throws SoundObjectException {
        CsdRenderResult result = CSDRenderService.getDefault()
                .generateCSDForBlueLive(this.data, false);
        String tempCSD = result.getCsdText();

        File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                BlueSystem.getCurrentProjectDirectory(), tempCSD);

        String osName = System.getProperty("os.name");

        String command;

        LiveData liveData = data.getLiveData();

        if (liveData.isCommandLineEnabled()) {
            if (liveData.isCommandLineOverride()) {
                command = liveData.getCommandLine();
            } else {
                command = ProjectPropertiesUtil.getRealtimeCommandLine(
                        data.getProjectProperties());
                command += " -Lstdin ";
                command += liveData.getCommandLine();
            }
        } else {
            command = ProjectPropertiesUtil.getRealtimeCommandLine(
                    data.getProjectProperties());
            command += " -Lstdin ";
        }

        if (osName.contains("Windows")) {
            command += " \"" + temp.getAbsolutePath() + "\"";
        } else {
            command += " " + temp.getAbsolutePath();
        }

        play(command, BlueSystem.getCurrentProjectDirectory(), -1);
    }

    public void play(String command, File currentWorkingDirectory,
            float renderStart) {
        // if(runProxy != null) {
        // stop();
        // }

//        AuditionManager audition = AuditionManager.getInstance();
//        audition.stop();
        runProxy = new RunProxy(command, currentWorkingDirectory, renderStart);
        Thread t = new Thread(runProxy);
        t.setPriority(Thread.MAX_PRIORITY);
        t.start();

    }

    @Override
    public boolean isRunning() {
        return console.isRunning();
    }

    @Override
    public void stop() {
        shouldStop = true;
        runProxy.stop();
    }

    @Override
    public void passToStdin(String text) {
        NoteList nl = null;

        try {
            nl = ScoreUtilities.getNotes(text);
        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
            nl = null;
        }

        if (nl == null) {
            return;
        }

        for (Iterator iter = nl.iterator(); iter.hasNext();) {
            Note note = (Note) iter.next();
            console.passToStdin(note.toString());
        }
    }

    @Override
    public void addBinding(CsoundBinding binding) {
        // no-op, commandline runner does not support bindings
    }

    @Override
    public void removeBinding(CsoundBinding binding) {
        // no-op, commandline runner does not support bindings
    }

    class RunProxy implements Runnable {

        String command;
        File currentWorkingDirectory;
        float renderStart = -1.0f;

        public RunProxy(String command, File currentWorkingDirectory,
                float renderStart) {
            this.renderStart = renderStart;
            this.command = command;
            this.currentWorkingDirectory = currentWorkingDirectory;
        }

        @Override
        public void run() {
            try {
                if (renderStart >= 0.0f) {
                    RenderTimeManager manager = Lookup.getDefault().lookup(
                            RenderTimeManager.class);
                    manager.initiateRender(renderStart);
                    console.setRenderTimeManager(manager);
                } else {
                    console.setRenderTimeManager(null);
                }
                console.execWait(command, currentWorkingDirectory);
            } catch (IOException ioe) {
                shouldStop = true;
                stop();
                NotificationDisplayer.getDefault().notify("Error", 
                        NotificationDisplayer.Priority.HIGH.getIcon(), 
                        ioe.getLocalizedMessage(),
                        null);
                System.err.println("[error] - " + ioe.getLocalizedMessage());
            }
        }

        public void stop() {
            if (console == null) {
                return;
            }
            console.destroy(true);
        }
    }

    @Override
    public void playModeChanged(int playMode) {
        if (playMode == PlayModeListener.PLAY_MODE_STOP) {

            if (console.getLastExitValue() != 0) {
                final GeneralSettings generalSettings = GeneralSettings.getInstance();

                if (generalSettings
                        .isCsoundErrorWarningEnabled()) {
                    if (errorPanel == null) {
                        errorPanel = new JPanel(new BorderLayout());
                        errorPanel
                                .add(
                                        new JLabel(
                                                "<html>There was an error in "
                                                + "running Csound.<br>"
                                                + "Please view the Csound Output Dialog for "
                                                + "more information.<br><br></html>"),
                                        BorderLayout.CENTER);
                        disableMessagesBox = new JCheckBox(
                                "Disable Error Message Dialog");
                        errorPanel.add(disableMessagesBox, BorderLayout.SOUTH);
                    }

                    disableMessagesBox.setSelected(false);

                    SwingUtilities.invokeLater(() -> {
                        JOptionPane.showMessageDialog(null, errorPanel,
                                "Csound Error", JOptionPane.ERROR_MESSAGE);
                        
                        if (disableMessagesBox.isSelected()) {
                            generalSettings
                                    .setCsoundErrorWarningEnabled(false);
                            generalSettings.save();
                        }
                    });

                }
                notifyPlayModeListeners(playMode);
                return;
            }

            if (data.isLoopRendering() && !shouldStop) {
                try {
                    render();
                } catch (SoundObjectException e) {

                    Exceptions.printStackTrace(e);
//                    ExceptionDialog.showExceptionDialog(parent, e);
                    notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
                }
            } else {
                notifyPlayModeListeners(playMode);
            }
        } else {
            notifyPlayModeListeners(playMode);
        }
    }
}
