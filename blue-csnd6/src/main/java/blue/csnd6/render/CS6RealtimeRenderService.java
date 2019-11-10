/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.csnd6.render;

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
import blue.soundObject.SoundObjectException;
import blue.utility.FileUtilities;
import blue.utility.TextUtilities;
import csnd6.Csound;
import csnd6.CsoundArgVList;
import csnd6.CsoundMYFLTArray;
import csnd6.controlChannelType;
import csnd6.csnd6;
import java.awt.BorderLayout;
import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
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
public class CS6RealtimeRenderService implements RealtimeRenderService, PlayModeListener {

    List<PlayModeListener> listeners = null;
    private BlueData data = null;
    APIRunnerThread runnerThread = null;
    JCheckBox disableMessagesBox = null;
    JPanel errorPanel = null;
    private boolean shouldStop;
    private BlueCallbackWrapper blueCallbackWrapper;
    private InputOutput io = null;

    private final List<CsoundBinding> bindings = new ArrayList<>();
    private Csound csound;

    public CS6RealtimeRenderService() {
//        csnd6.csoundInitialize(csnd6.CSOUNDINIT_NO_ATEXIT
//                | csnd6.CSOUNDINIT_NO_SIGNAL_HANDLER);
    }

    @Override
    public String toString() {
        return "Csound 6 API";
    }

    @Override
    public boolean isRunning() {
        return runnerThread != null;
    }

    public void play(BlueData blueData, CsdRenderResult result,
            String[] args, File currentWorkingDirectory, double renderStart) {

        if (runnerThread != null) {
            runnerThread.setKeepRunning(false);
            runnerThread.await();
        }

        this.csound = new Csound();
        blueCallbackWrapper = new BlueCallbackWrapper(csound);
        blueCallbackWrapper.SetMessageCallback();

        if (this.io != null) {
            try {
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

                SwingUtilities.invokeLater(() -> {
                    JOptionPane.showMessageDialog(null, errorPanel,
                            "Csound Error", JOptionPane.ERROR_MESSAGE);

                    if (disableMessagesBox.isSelected()) {
                        GeneralSettings.getInstance().setCsoundErrorWarningEnabled(
                                false);
                        GeneralSettings.getInstance().save();
                    }
                });

            }
            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
            csound.Stop();
            csound.Cleanup();
            csound.SetMessageCallback(null);
            csound.Reset();
            csound = null;
            blueCallbackWrapper = null;
            return;

        }

        runnerThread = new APIRunnerThread(blueData, csound, this,
                result.getParameters(), result.getStringChannels(),
                result.getTempoMapper(), renderStart, bindings);

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_PLAY);
        Thread t = new Thread(runnerThread);
        t.setPriority(Thread.MAX_PRIORITY);
        t.start();
    }

    @Override
    public void render() throws SoundObjectException {
        if (this.data == null) {
            return;
        }

//        csnd6.csoundInitialize(csnd6.CSOUNDINIT_NO_SIGNAL_HANDLER);
        shouldStop = false;

        String command;

        try {

            command = ProjectPropertiesUtil.getRealtimeCommandLine(
                    data.getProjectProperties());

            String globalSco = data.getGlobalOrcSco().getGlobalSco();
            globalSco = TextUtilities.stripMultiLineComments(globalSco);
            globalSco = TextUtilities.stripSingleLineComments(globalSco);

            double startTime = data.getRenderStartTime();
            double endTime = data.getRenderEndTime();

            CsdRenderResult result = CSDRenderService.getDefault().generateCSD(
                    data, startTime, endTime, true, true);

            RenderTimeManager timeManager = Lookup.getDefault().lookup(
                    RenderTimeManager.class);
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

    @Override
    public void renderForBlueLive() throws SoundObjectException {

//        csnd6.csoundInitialize(csnd6.CSOUNDINIT_NO_SIGNAL_HANDLER);
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
                command += liveData.getCommandLine();
            }
        } else {
            command = ProjectPropertiesUtil.getRealtimeCommandLine(
                    data.getProjectProperties());
        }

        command += " --omacro:BLUE_LIVE=1  --smacro:BLUE_LIVE=1 ";

        String[] args = command.split("\\s+");
        String[] args2 = new String[args.length + 1];
        System.arraycopy(args, 0, args2, 0, args.length);
        args2[args.length] = temp.getAbsolutePath();

        play(this.data, result, args2, BlueSystem.getCurrentProjectDirectory(),
                -1.0f);
    }

    @Override
    public void setData(BlueData data) {
        this.data = data;
    }

    @Override
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

    @Override
    public void passToStdin(String text) {
        if (runnerThread != null && runnerThread.csound != null) {
            runnerThread.evalScore(text);
        }
//        NoteList nl = null;
//
//        try {
//            nl = ScoreUtilities.getNotes(text);
//        } catch (NoteParseException e) {
//            e.printStackTrace();
//            nl = null;
//        }
//
//        if (nl == null) {
//            return;
//        }
//
//        for (Iterator iter = nl.iterator(); iter.hasNext();) {
//            Note note = (Note) iter.next();
//            runnerThread.passToStdin(note.toString());
//        }
    }

    @Override
    public void addPlayModeListener(PlayModeListener listener) {
        if (listeners == null) {
            listeners = new Vector<PlayModeListener>();
        }

        listeners.add(listener);
    }

    @Override
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

    @Override
    public void playModeChanged(int playMode) {
        if (playMode == PlayModeListener.PLAY_MODE_STOP) {

            if (runnerThread != null) {
                runnerThread.setKeepRunning(false);
                runnerThread = null;
            }

            if (data.isLoopRendering() && !shouldStop) {

                new Thread() {
                    @Override
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
        if (isRunning()) {
            binding.setup(csound.GetSr(), csound.GetKsmps());
        }
        bindings.add(binding);
    }

    @Override
    public void removeBinding(CsoundBinding binding) {
        bindings.remove(binding);
        if (isRunning()) {
            binding.cleanup();
        }
    }

    @Override
    public void evalOrc(String orchestra) {
        if (runnerThread != null && runnerThread.csound != null) {
            runnerThread.evalOrc(orchestra);
        }
    }

    static class APIRunnerThread implements Runnable {

        private Csound csound;
        private boolean keepRunning = true;
        private PlayModeListener playModeListener;
        private ArrayList parameters;
        private ArrayList<StringChannel> stringChannels;
        private TempoMapper mapper;
        private double startTime;
        private BlueData blueData;
        private double[] valuesCache;
        private CsoundMYFLTArray[] channelPtrCache;
        public boolean isRunning = true;
        CountDownLatch latch = new CountDownLatch(1);
        private final List<CsoundBinding> bindings;
        MessageBuffer buffer = new MessageBuffer();

        public APIRunnerThread(BlueData blueData,
                Csound csound,
                PlayModeListener playModeListener,
                ArrayList parameters,
                ArrayList<StringChannel> stringChannels,
                TempoMapper mapper,
                double startTime,
                List<CsoundBinding> bindings) {
            this.blueData = blueData;
            this.csound = csound;
            this.playModeListener = playModeListener;
            this.parameters = parameters;
            this.stringChannels = stringChannels;
            this.mapper = mapper;
            this.startTime = startTime;
            this.bindings = bindings;
        }

        public void evalScore(String sco) {
            buffer.postMessage(0, sco);
        }

        public void evalOrc(String orc) {
            buffer.postMessage(1, orc);
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

        @Override
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

            double scoreTime = csound.GetScoreTime();
            double currentTime = 0.0f;
            double renderStartSeconds = 0.0f;

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

            for (int i = 0; i < bindings.size(); i++) {
                bindings.get(i).setup(csound.GetSr(), csound.GetKsmps());
            }

            currentTime = (blueData == null) ? 0.0f : blueData.getRenderStartTime();

            final int capacity = buffer.getCapacity();

            while (keepRunning) {

                // process messages
                int start = buffer.getReadStart();
                int end = buffer.getReadEnd();
                int last = (end < start) ?  end + capacity : end;

                for(int i = buffer.getReadStart(); i < last; i++) {
                    Message m = buffer.getMessage(i % capacity);
                    switch(m.messageType) {
                        case 0:
                            csound.ReadScore(m.payload);
                            break;
                        case 1:
                            csound.CompileOrc(m.payload);
                            break;
                    }

                }
                buffer.setReadStart(end);
                
                counter++;

                scoreTime = csound.GetScoreTime();

                if (renderUpdatesTime && counter > updateRate) {
                    manager.updateTimePointer(scoreTime);
                    counter = 0;
                }

                if(blueData == null) {
                    if (renderUpdatesTime) {
                        if (mapper != null) {
                            currentTime = mapper.secondsToBeats(
                                    scoreTime + renderStartSeconds);
                        } else {
                            currentTime = startTime + scoreTime;
                        }
                    }
                }

                double value;

                for (int i = 0, size = parameters.size(); i < size; i++) {
                    param = (Parameter) parameters.get(i);
//                    String varName = param.getCompilationVarName();

                    if (blueData == null) {
                        value = param.getValue(currentTime);
                    } else {
                        value = param.getFixedValue();
                    }

                    if (value != valuesCache[i]) {
                        valuesCache[i] = value;
                        channelPtrCache[i].SetValue(0, value);
                    }
                }

                for (int i = 0, size = stringChannels.size(); i < size; i++) {
                    StringChannel strChannel = stringChannels.get(i);
                    if (strChannel.isDirty()) {
//                        System.out.println(
//                                "Setting Channel: " + strChannel.getChannelName() + " : " + strChannel.getValue());
                        csound.SetChannel(strChannel.getChannelName(),
                                strChannel.getValue());
                    }
                }

                for (int i = 0, size = bindings.size(); i < size; i++) {
                    bindings.get(i).updateValueToCsound();
                }

                keepRunning = csound.PerformKsmps() == 0 && keepRunning;

                for (int i = 0, size = bindings.size(); i < size; i++) {
                    bindings.get(i).updateValueFromCsound();
                }
            }

            for (int i = 0; i < bindings.size(); i++) {
                bindings.get(i).cleanup();
            }

            bindings.clear();

            csound.Stop();
            csound.Cleanup();
            csound.SetMessageCallback(null);
            csound.Reset();

            if (renderUpdatesTime) {
                manager.endRender();
            }

            playModeListener.playModeChanged(PlayModeListener.PLAY_MODE_STOP);

            latch.countDown();

        }

        private void createValuesCache(double currentTime) {
            Parameter param;
            final int size = parameters.size();

            valuesCache = new double[size];
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
                        controlChannelType.CSOUND_CONTROL_CHANNEL.swigValue() | controlChannelType.CSOUND_INPUT_CHANNEL.swigValue());

                channelPtrCache[i].SetValue(0, valuesCache[i]);
            }
        }
    }
}
