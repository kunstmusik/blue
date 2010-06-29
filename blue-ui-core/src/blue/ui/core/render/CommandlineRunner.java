package blue.ui.core.render;

import java.awt.BorderLayout;
import java.awt.Component;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;

import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;

import blue.BlueData;
import blue.BlueSystem;
import blue.LiveData;
import blue.event.PlayModeListener;
import blue.gui.ExceptionDialog;
import blue.noteProcessor.TempoMapper;
import blue.ui.core.score.AuditionManager;
import blue.score.tempo.Tempo;
import blue.settings.GeneralSettings;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.SoundObjectException;
import blue.utility.FileUtilities;
import blue.utility.ProjectPropertiesUtil;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;
import org.openide.awt.StatusDisplayer;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author
 * @version 1.0
 */

public class CommandlineRunner implements PlayModeListener, CSDRunner {
    ProcessConsole console = new ProcessConsole();

    RunProxy runProxy;

    ArrayList<PlayModeListener> listeners = new ArrayList<PlayModeListener>();

    private BlueData data = null;

    private boolean shouldStop = false;

    private Component parent;

    JCheckBox disableMessagesBox = null;

    JPanel errorPanel = null;

    public CommandlineRunner(Component parent) {
        this.parent = parent;
        console.addPlayModeListener(this);

        AuditionManager audition = AuditionManager.getInstance();
        audition.addPlayModeListener(new PlayModeListener() {

            public void playModeChanged(int playMode) {
                if (playMode == PlayModeListener.PLAY_MODE_PLAY) {
                    if (isRunning()) {
                        stop();
                    }
                }

            }

        });
    }

    public void addPlayModeListener(PlayModeListener listener) {
        listeners.add(listener);
    }

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

    public void setData(BlueData data) {
        this.data = data;
    }

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

            Tempo tempo = data.getTempo();
            TempoMapper tempoMapper = null;
            
            if(tempo.isEnabled()) {
                tempoMapper = CSDRender.getTempoMapper(tempo);
            } else {
                tempoMapper = CSDRender.getTempoMapper(globalSco);
            }
            
//            System.out.println(tempoMapper);

            RenderTimeManager timeManager = RenderTimeManager.getInstance();
            timeManager.setTempoMapper(tempoMapper);
            timeManager.setRootPolyObject(data.getPolyObject());

            float startTime = data.getRenderStartTime();
            float endTime = data.getRenderEndTime();

            CsdRenderResult result = CSDRender.generateCSD(data, startTime, endTime);
            
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
        } catch (Exception ex) {
            StatusDisplayer.getDefault().setStatusText(
                    "[" + BlueSystem.getString("message.error")
                    + "] "
                    + BlueSystem.getString("message.generateScore.error"));
            System.err.println("[" + BlueSystem.getString("message.error")
                    + "] " + ex.getLocalizedMessage());
        }
    }

    public void renderForBlueLive() throws SoundObjectException {
        CsdRenderResult result = CSDRender.generateCSDForBlueLive(this.data);
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

        if (osName.indexOf("Windows") >= 0) {
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

        AuditionManager audition = AuditionManager.getInstance();
        audition.stop();

        runProxy = new RunProxy(command, currentWorkingDirectory, renderStart);
        Thread t = new Thread(runProxy);
        t.setPriority(Thread.MAX_PRIORITY);
        t.start();

    }

    public boolean isRunning() {
        return console.isRunning();
    }

    public void stop() {
        shouldStop = true;
        runProxy.stop();
    }

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

        public void run() {
            try {
                if(renderStart >= 0.0f) {
                    RenderTimeManager manager = RenderTimeManager.getInstance();
                    manager.initiateRender(renderStart);
                    console.setRenderTimeManager(manager);
                } else {
                    console.setRenderTimeManager(null);
                }
                console.execWait(command, currentWorkingDirectory);
            } catch (IOException ioe) {
                stop();
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

                    JOptionPane.showMessageDialog(null, errorPanel,
                            "Csound Error", JOptionPane.ERROR_MESSAGE);

                    if (disableMessagesBox.isSelected()) {
                        generalSettings
                                .setCsoundErrorWarningEnabled(false);
                        generalSettings.save();
                    }
                }
                notifyPlayModeListeners(playMode);
                return;
            }

            if (data.isLoopRendering() && !shouldStop) {
                try {
                    render();
                } catch (SoundObjectException e) {
                    ExceptionDialog.showExceptionDialog(parent, e);
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
