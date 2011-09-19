/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.render;

import blue.BlueData;
//import blue.BlueMainFrame;
import blue.BlueSystem;
import blue.LiveData;
import blue.automation.Parameter;
import blue.event.PlayModeListener;
import blue.noteProcessor.TempoMapper;
import blue.ui.core.score.AuditionManager;
import blue.score.tempo.Tempo;
import blue.settings.GeneralSettings;
import blue.settings.PlaybackSettings;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.SoundObjectException;
import blue.utility.FileUtilities;
import blue.utility.ProjectPropertiesUtil;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;
import csnd.Csound;
import csnd.CsoundArgVList;
import csnd.csnd;
import java.awt.BorderLayout;
import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Exceptions;
import org.openide.windows.IOColors;
import org.openide.windows.IOProvider;
import org.openide.windows.InputOutput;

/**
 *
 * @author syi
 */
public class APIRunner implements CSDRunner, PlayModeListener {

    Vector<PlayModeListener> listeners = null;

    private BlueData data = null;

    APIRunnerThread runnerThread = null;

    JCheckBox disableMessagesBox = null;

    JPanel errorPanel = null;

    private boolean shouldStop;

    private BlueCallbackWrapper blueCallbackWrapper;

    private InputOutput io = null;

    public APIRunner() {

        AuditionManager audition = AuditionManager.getInstance();
        audition.addPlayModeListener(new PlayModeListener() {

            public void playModeChanged(int playMode) {

                if (playMode == PlayModeListener.PLAY_MODE_PLAY) {
                    if (isRunning()) {
                        stop();
                        blueCallbackWrapper.setInputOutput(null);
                    }
                }

            }
        });

    }

    public boolean isRunning() {
        return runnerThread != null;
    }

    public void play(BlueData blueData, CsdRenderResult result,
            TempoMapper mapper,
            String[] args, File currentWorkingDirectory, float renderStart) {
        AuditionManager audition = AuditionManager.getInstance();
        audition.stop();

        if (runnerThread != null) {
            runnerThread.setKeepRunning(false);
        }

//        if (csound == null) {
        csnd.csoundInitialize(null, null, csnd.CSOUNDINIT_NO_SIGNAL_HANDLER);
        Csound csound = new Csound();
        blueCallbackWrapper = new BlueCallbackWrapper(csound);
        blueCallbackWrapper.SetMessageCallback();
//        }


        if (this.io != null) {
            try {
//            this.io.closeInputOutput();
                this.io.getOut().reset();
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        io = IOProvider.getDefault().getIO("Csound", false);
        IOColors.setColor(io, IOColors.OutputType.OUTPUT, Color.WHITE);

        blueCallbackWrapper.setInputOutput(io);

        CsoundArgVList argsList = new CsoundArgVList();

        for (int i = 0; i < args.length; i++) {
            argsList.Append(args[i]);
//            System.out.println("[" + i + "] " + args[i] );
        }

        int retVal = csound.Compile(argsList.argc(), argsList.argv());

        if (retVal != 0) {

            if (GeneralSettings.getInstance().isCsoundErrorWarningEnabled()) {
                if (errorPanel == null) {
                    errorPanel = new JPanel(new BorderLayout());
                    errorPanel.add(
                            new JLabel(
                            "<html>There was an error in " + "running Csound.<br>" + "Please view the Csound Output Dialog for " + "more information.<br><br></html>"),
                            BorderLayout.CENTER);
                    disableMessagesBox = new JCheckBox(
                            "Disable Error Message Dialog");
                    errorPanel.add(disableMessagesBox, BorderLayout.SOUTH);
                }

                disableMessagesBox.setSelected(false);

                JOptionPane.showMessageDialog(null, errorPanel,
                        "Csound Error", JOptionPane.ERROR_MESSAGE);

                if (disableMessagesBox.isSelected()) {
                    GeneralSettings.getInstance().setCsoundErrorWarningEnabled(
                            false);
                    GeneralSettings.getInstance().save();
                }
            }
            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
            csound.SetMessageCallback(null);
            csound.SetHostData(null);
            csound.Stop();
            csound.Reset();
            csound = null;
            blueCallbackWrapper = null;
            return;

        }

        runnerThread = new APIRunnerThread(blueData, csound, this,
                result.getParameters(), mapper, renderStart);

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_PLAY);
        Thread t = new Thread(runnerThread);
        t.setPriority(Thread.MAX_PRIORITY);
        t.start();
    }

    public void render() throws SoundObjectException {
        if (this.data == null) {
            return;
        }

        shouldStop = false;

        String command;

        try {

            command = ProjectPropertiesUtil.getRealtimeCommandLine(
                    data.getProjectProperties());


            String globalSco = data.getGlobalOrcSco().getGlobalSco();
            globalSco = TextUtilities.stripMultiLineComments(globalSco);
            globalSco = TextUtilities.stripSingleLineComments(globalSco);

            Tempo tempo = data.getTempo();
            TempoMapper tempoMapper = null;

            if (tempo.isEnabled()) {
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

            CsdRenderResult result = CSDRender.generateCSD(data, startTime,
                    endTime);

            String csd = result.getCsdText();

            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                    BlueSystem.getCurrentProjectDirectory(), csd);

            String[] args = command.split("\\s+");
            String[] args2 = new String[args.length + 1];
            System.arraycopy(args, 0, args2, 0, args.length);
            args2[args.length] = temp.getAbsolutePath();

            play(null, result, tempoMapper, args2, BlueSystem.getCurrentProjectDirectory(), startTime);
        } catch (SoundObjectException soe) {
            throw soe;
        } catch (Exception ex) {
            StatusDisplayer.getDefault().setStatusText("[" + BlueSystem.getString("message.error") + "] " + BlueSystem.getString("message.generateScore.error"));
            System.err.println("[" + BlueSystem.getString("message.error") + "] " + ex.getLocalizedMessage());
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
//                command += " -Lstdin ";
                command += liveData.getCommandLine();
            }
        } else {
            command = ProjectPropertiesUtil.getRealtimeCommandLine(
                    data.getProjectProperties());
//            command += " -Lstdin ";
        }

//        if (osName.indexOf("Windows") >= 0) {
//            command += " \"" + temp.getAbsolutePath() + "\"";
//        } else {
//            command += " " + temp.getAbsolutePath();
//        }   

        String[] args = command.split("\\s+");
        String[] args2 = new String[args.length + 1];
        System.arraycopy(args, 0, args2, 0, args.length);
        args2[args.length] = temp.getAbsolutePath();

        play(this.data, result, null, args2, BlueSystem.getCurrentProjectDirectory(), -1.0f);
//        play(command, BlueSystem.getCurrentProjectDirectory(), -1);
    }

    public void setData(BlueData data) {
        this.data = data;
    }

    public void stop() {
        if (runnerThread != null) {
            shouldStop = true;
            runnerThread.setKeepRunning(false);
            runnerThread = null;
        }

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
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
            runnerThread.passToStdin(note.toString());
        }
    }

    public void addPlayModeListener(PlayModeListener listener) {
        if (listeners == null) {
            listeners = new Vector<PlayModeListener>();
        }

        listeners.add(listener);
    }

    public void removePlayModeListener(PlayModeListener listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    protected void notifyPlayModeListeners(int playMode) {
        if (listeners == null) {
            return;
        }

        for (Iterator<PlayModeListener> iter = listeners.iterator(); iter.hasNext();) {
            PlayModeListener listener = iter.next();
            listener.playModeChanged(playMode);
        }
    }

    public void playModeChanged(int playMode) {
        if (playMode == PlayModeListener.PLAY_MODE_STOP) {

            if (runnerThread != null) {
                runnerThread.setKeepRunning(false);
                runnerThread = null;
            }


            if (data.isLoopRendering() && !shouldStop) {

                new Thread() {

                    public void run() {
                        try {
                            render();
                        } catch (SoundObjectException e) {
                            Exceptions.printStackTrace(e);
                            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
                        }
                    }
                }.start();
            } else {
                notifyPlayModeListeners(playMode);
            }
        } else {
            notifyPlayModeListeners(playMode);
        }

    }

    static class APIRunnerThread implements Runnable {

        private Csound csound;

        private boolean keepRunning = true;

        private PlayModeListener playModeListener;

        private ArrayList parameters;

        private TempoMapper mapper;

        private float startTime;

        private BlueData blueData;

        private float[] valuesCache;

        public APIRunnerThread(BlueData blueData,
                Csound csound,
                PlayModeListener playModeListener,
                ArrayList parameters,
                TempoMapper mapper,
                float startTime) {
            this.blueData = blueData;
            this.csound = csound;
            this.playModeListener = playModeListener;
            this.parameters = parameters;
            this.mapper = mapper;
            this.startTime = startTime;
        }

        public void passToStdin(String note) {
            this.csound.InputMessage(note);
        }

        public void setKeepRunning(boolean val) {
            keepRunning = val;
        }

        public void run() {
            int updateRate = (int) (csound.GetKr()
                    / PlaybackSettings.getInstance().getPlaybackFPS());
            int counter = 0;


            RenderTimeManager manager = null;
            final boolean renderUpdatesTime = startTime >= 0.0F;

            if (renderUpdatesTime) {
                manager = RenderTimeManager.getInstance();
                manager.initiateRender(startTime);
            }

            Parameter param;

            float scoreTime = (float) csound.GetScoreTime();
            float currentTime = 0.0f;

            if (renderUpdatesTime) {
                if (mapper != null) {
                    float renderStartSeconds = mapper.beatsToSeconds(startTime);
                    currentTime = mapper.secondsToBeats(
                            scoreTime + renderStartSeconds);
                    currentTime -= startTime;
                } else {
                    currentTime = startTime + scoreTime;
                }
            }

            createValuesCache(currentTime);

            do {
                counter++;

                scoreTime = (float) csound.GetScoreTime();


                if (renderUpdatesTime && counter > updateRate) {
                    manager.updateTimePointer(scoreTime);
                    counter = 0;
                }

                currentTime = 0.0f;

                if (renderUpdatesTime) {
                    if (mapper != null) {
                        float renderStartSeconds = mapper.beatsToSeconds(
                                startTime);
                        currentTime = mapper.secondsToBeats(
                                scoreTime + renderStartSeconds);
                        currentTime -= startTime;
                    } else {
                        currentTime = startTime + scoreTime;
                    }
                }

                if (blueData != null) {
                    currentTime = blueData.getRenderStartTime();
                }

                float value;

                for (int i = 0; i < parameters.size(); i++) {
                    param = (Parameter) parameters.get(i);
                    String varName = param.getCompilationVarName();

                    if (blueData == null) {
                        value = param.getValue(currentTime);
                    } else {
                        value = param.getFixedValue();
                    }

                    if (value != valuesCache[i]) {
                        valuesCache[i] = value;
                        csound.SetChannel(varName, (double) value);
                    }
                }
            } while (csound.PerformKsmps() == 0 && keepRunning);

            csound.Stop();
            csound.SetMessageCallback(null);
            csound.SetHostData(null);
            csound.Reset();
            
            if (renderUpdatesTime) {
                RenderTimeManager.getInstance().endRender();
            }

            playModeListener.playModeChanged(PlayModeListener.PLAY_MODE_STOP);


        }

        private void createValuesCache(float currentTime) {
            Parameter param;
            final int size = parameters.size();

            valuesCache = new float[size];

            for (int i = 0; i < size; i++) {
                param = (Parameter) parameters.get(i);
                String varName = param.getCompilationVarName();

                if (blueData == null) {
                    valuesCache[i] = param.getValue(currentTime);

                } else {
                    valuesCache[i] = param.getFixedValue();
                }

                csound.SetChannel(varName, (double) valuesCache[i]);
            }
        }
    }
}
