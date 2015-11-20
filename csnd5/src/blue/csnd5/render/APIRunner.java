/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.csnd5.render;

import blue.services.render.CsdRenderResult;
import blue.BlueData;
//import blue.BlueMainFrame;
import blue.BlueSystem;
import blue.LiveData;
import blue.automation.Parameter;
import blue.event.PlayModeListener;
import blue.noteProcessor.TempoMapper;
import blue.orchestra.blueSynthBuilder.StringChannel;
import blue.services.render.CSDRenderService;
import blue.services.render.CsoundBinding;
import blue.services.render.RealtimeRenderService;
import blue.services.render.RenderTimeManager;
import blue.settings.GeneralSettings;
import blue.settings.PlaybackSettings;
import blue.settings.ProjectPropertiesUtil;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.SoundObjectException;
import blue.utility.FileUtilities;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;
import csnd.Csound;
import csnd.CsoundArgVList;
import csnd.CsoundMYFLTArray;
import csnd.csndConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import java.util.concurrent.CountDownLatch;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.windows.IOColors;
import org.openide.windows.IOProvider;
import org.openide.windows.InputOutput;

/**
 *
 * @author syi
 */
public class APIRunner implements RealtimeRenderService, PlayModeListener {

    Vector<PlayModeListener> listeners = null;
    private BlueData data = null;
    APIRunnerThread runnerThread = null;
    JCheckBox disableMessagesBox = null;
    JPanel errorPanel = null;
    private boolean shouldStop;
    private BlueCallbackWrapper blueCallbackWrapper;
    private InputOutput io = null;

    public APIRunner() {

//        AuditionManager audition = AuditionManager.getInstance();
//        audition.addPlayModeListener(new PlayModeListener() {
//            public void playModeChanged(int playMode) {
//
//                if (playMode == PlayModeListener.PLAY_MODE_PLAY) {
//                    if (isRunning()) {
//                        stop();
//                        blueCallbackWrapper.setInputOutput(null);
//                    }
//                }
//
//            }
//        });

    }

    @Override
    public String toString() {
        return "Csound 5 API";
    }

    public boolean isRunning() {
        return runnerThread != null;
    }

    public void play(BlueData blueData, CsdRenderResult result,
            String[] args, File currentWorkingDirectory, float renderStart) {

        if (runnerThread != null) {
            runnerThread.setKeepRunning(false);
            runnerThread.await();
        }

        Csound csound = new Csound();
        blueCallbackWrapper = new BlueCallbackWrapper(csound);
        blueCallbackWrapper.SetMessageCallback();


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

        io.getOut().append("Render Command (");

        for (int i = 0; i < args.length; i++) {
            argsList.Append(args[i]);
            io.getOut().append(" ").append(args[i]);
//            System.out.println("[" + i + "] " + args[i] );
        }

        if (currentWorkingDirectory != null) {
            String sfdir = "--env:SFDIR=" + currentWorkingDirectory.getAbsolutePath();
            argsList.Append(sfdir);
            io.getOut().append(" ").append(sfdir);
        }
        
        io.getOut().append(" )\n");

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

                SwingUtilities.invokeLater(new Runnable() {
                    public void run() {
                        JOptionPane.showMessageDialog(null, errorPanel,
                                "Csound Error", JOptionPane.ERROR_MESSAGE);

                        if (disableMessagesBox.isSelected()) {
                            GeneralSettings.getInstance().setCsoundErrorWarningEnabled(
                                    false);
                            GeneralSettings.getInstance().save();
                        }
                    }
                });

            }
            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
            csound.Stop();
            csound.Cleanup();
            csound.SetMessageCallback(null);
            csound.SetHostData(null);
            csound.Reset();
            csound = null;
            blueCallbackWrapper = null;
            return;

        }

        runnerThread = new APIRunnerThread(blueData, csound, this,
                result.getParameters(), result.getStringChannels(),
                result.getTempoMapper(), renderStart);

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

//            System.out.println(tempoMapper);

            //FIXME
            //timeManager.setRootPolyObject(data.getPolyObject());

            float startTime = data.getRenderStartTime();
            float endTime = data.getRenderEndTime();

            CsdRenderResult result = CSDRenderService.getDefault().generateCSD(
                    data, startTime, endTime, true, true);

            RenderTimeManager timeManager = Lookup.getDefault().lookup(RenderTimeManager.class);
            timeManager.setTempoMapper(result.getTempoMapper());

            String csd = result.getCsdText();

            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                    BlueSystem.getCurrentProjectDirectory(), csd);

            String[] args = command.split("\\s+");
            String[] args2 = new String[args.length + 1];
            System.arraycopy(args, 0, args2, 0, args.length);
            args2[args.length] = temp.getAbsolutePath();

            play(null, result, args2, BlueSystem.getCurrentProjectDirectory(),
                    startTime);
        } catch (SoundObjectException soe) {
            throw soe;
        } catch (Exception ex) {
            StatusDisplayer.getDefault().setStatusText(
                    "[" + BlueSystem.getString("message.error") + "] " + BlueSystem.getString(
                    "message.generateScore.error"));
            ex.printStackTrace();
        }
    }

    public void renderForBlueLive() throws SoundObjectException {
        CsdRenderResult result = CSDRenderService.getDefault().generateCSDForBlueLive(
                this.data, true);

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

        play(this.data, result, args2, BlueSystem.getCurrentProjectDirectory(),
                -1.0f);
//        play(command, BlueSystem.getCurrentProjectDirectory(), -1);
    }

    public void setData(BlueData data) {
        this.data = data;
    }

    public void stop() {
        if (runnerThread != null) {
            shouldStop = true;
            APIRunnerThread runner = runnerThread;
            runnerThread = null;
            runner.setKeepRunning(false);
            runner.await();
            runner = null;
        }

        //notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
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
                            notifyPlayModeListeners(
                                    PlayModeListener.PLAY_MODE_STOP);
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

    @Override
    public void addBinding(CsoundBinding binding) {
        // no-op for now, not sure if Csound 5 should continue to be supported
    }

    @Override
    public void removeBinding(CsoundBinding binding) {
        // no-op for now, not sure if Csound 5 should continue to be supported
    }

    static class APIRunnerThread implements Runnable {

        private Csound csound;
        private boolean keepRunning = true;
        private PlayModeListener playModeListener;
        private ArrayList parameters;
        private ArrayList<StringChannel> stringChannels;
        private TempoMapper mapper;
        private float startTime;
        private BlueData blueData;
        private float[] valuesCache;
        private CsoundMYFLTArray[] channelPtrCache;
        public boolean isRunning = true;
        CountDownLatch latch = new CountDownLatch(1);

        public APIRunnerThread(BlueData blueData,
                Csound csound,
                PlayModeListener playModeListener,
                ArrayList parameters,
                ArrayList<StringChannel> stringChannels,
                TempoMapper mapper,
                float startTime) {
            this.blueData = blueData;
            this.csound = csound;
            this.playModeListener = playModeListener;
            this.parameters = parameters;
            this.stringChannels = stringChannels;
            this.mapper = mapper;
            this.startTime = startTime;
        }

        public void passToStdin(String note) {
            this.csound.InputMessage(note);
        }

        public void setKeepRunning(boolean val) {
            keepRunning = val;
        }

        public void await() {
            try {
                latch.await();
            } catch (InterruptedException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        public void run() {
            int updateRate = (int) (csound.GetKr()
                    / PlaybackSettings.getInstance().getPlaybackFPS());
            int counter = 0;


            RenderTimeManager manager = null;
            final boolean renderUpdatesTime = startTime >= 0.0F;

            if (renderUpdatesTime) {
                manager = Lookup.getDefault().lookup(RenderTimeManager.class);
                manager.initiateRender(startTime);
            }

            Parameter param;

            float scoreTime = (float) csound.GetScoreTime();
            float currentTime = 0.0f;
            float renderStartSeconds = 0.0f;

            if (renderUpdatesTime) {
                if (mapper != null) {
                    renderStartSeconds = mapper.beatsToSeconds(startTime);
                    currentTime = mapper.secondsToBeats(
                            scoreTime + renderStartSeconds);
                } else {
                    currentTime = startTime + scoreTime;
                }
            }

            createValuesCache(currentTime);

            for (StringChannel strChannel : stringChannels) {
                csound.SetChannel(strChannel.getChannelName(),
                        strChannel.getValue());
            }

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
                        currentTime = mapper.secondsToBeats(
                                scoreTime + renderStartSeconds);
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
                        channelPtrCache[i].SetValue(0, (double) value);
                    }
                }

                for (StringChannel strChannel : stringChannels) {
                    if (strChannel.isDirty()) {
                        System.out.println(
                                "Setting Channel: " + strChannel.getChannelName() + " : " + strChannel.getValue());
                        csound.SetChannel(strChannel.getChannelName(),
                                strChannel.getValue());
                    }
                }
            } while (csound.PerformKsmps() == 0 && keepRunning);

            csound.Stop();
            csound.Cleanup();
            csound.SetMessageCallback(null);
            csound.SetHostData(null);
            csound.Reset();

            if (renderUpdatesTime) {
                manager.endRender();
            }

            playModeListener.playModeChanged(PlayModeListener.PLAY_MODE_STOP);

            latch.countDown();

        }

        private void createValuesCache(float currentTime) {
            Parameter param;
            final int size = parameters.size();

            valuesCache = new float[size];
            channelPtrCache = new CsoundMYFLTArray[size];

            for (int i = 0; i < size; i++) {
                param = (Parameter) parameters.get(i);
                String varName = param.getCompilationVarName();

                if (blueData == null) {
                    valuesCache[i] = param.getValue(currentTime);

                } else {
                    valuesCache[i] = param.getFixedValue();
                }

                channelPtrCache[i] = new CsoundMYFLTArray(1);
                csound.GetChannelPtr(channelPtrCache[i].GetPtr(), varName,
                        csndConstants.CSOUND_CONTROL_CHANNEL | csndConstants.CSOUND_INPUT_CHANNEL);

                channelPtrCache[i].SetValue(0, valuesCache[i]);
            }
        }
    }
}
