package blue.csnd6.render;

import blue.BlueData;
import blue.BlueSystem;
import java.io.File;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;

import blue.automation.Parameter;
import blue.event.PlayModeListener;
import blue.noteProcessor.TempoMapper;
import blue.score.ScoreGenerationException;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.services.render.DiskRenderJob;
import blue.services.render.DiskRenderService;
import blue.services.render.RenderTimeManager;
import blue.settings.PlaybackSettings;
import blue.utility.FileUtilities;
import com.kunstmusik.csoundjni.Csound;

import java.awt.Color;
import java.io.IOException;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.windows.IOColors;
import org.openide.windows.IOProvider;
import org.openide.windows.InputOutput;

public class CS6DiskRendererService implements DiskRenderService {

    Vector listeners = new Vector();
    RenderTimeManager renderTimeManager = null;
    private volatile boolean keepRunning = false;
    // NOTE: Must store at class level to prevent pre-mature garbage collection
    // and crashing!
    BlueCallbackWrapper blueCallbackWrapper; 

    public CS6DiskRendererService() {
//        csnd6.csoundInitialize(csnd6.CSOUNDINIT_NO_ATEXIT | 
//                csnd6.CSOUNDINIT_NO_SIGNAL_HANDLER);
    }

    @Override
    public String toString() {
        return "Csound 6 API";
    }

    @Override
    public boolean isRunning() {
        return keepRunning;
    }

    public void setRenderTimeManager(RenderTimeManager renderTimeManager) {
        this.renderTimeManager = renderTimeManager;
    }

    private void initialize() {
        keepRunning = true;
    }

    private void exec(String[] args,
            File currentWorkingDirectory,
            double startTime,
            TempoMapper mapper,
            ArrayList<Parameter> parameters) {

        //csnd.csoundInitialize(null, null, csnd.CSOUNDINIT_NO_SIGNAL_HANDLER);
        Csound csound = new Csound();
        blueCallbackWrapper = new BlueCallbackWrapper();
        csound.setMessageCallback(blueCallbackWrapper);
        final InputOutput ioProvider = IOProvider.getDefault().
                getIO("Csound", false);

        try {
//            this.io.closeInputOutput();
            ioProvider.getOut().reset();
        } catch (IOException ex) {
            Exceptions.printStackTrace(ex);
        }

        IOColors.setColor(ioProvider, IOColors.OutputType.OUTPUT, Color.WHITE);
        blueCallbackWrapper.setInputOutput(ioProvider);

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_PLAY);

        var argsList = new ArrayList<String>();
        ioProvider.getOut().append("Render Command (");

        for (int i = 0; i < args.length; i++) {
            if (args[i].startsWith("\"") && args[i].endsWith("\"")) {
                args[i] = args[i].substring(1, args[i].length() - 1);
            }
            argsList.add(args[i]);
            ioProvider.getOut().append(" ").append(args[i]);
        }

        if (currentWorkingDirectory != null) {
            String sfdir = "--env:SFDIR=" + currentWorkingDirectory.getAbsolutePath();
            argsList.add(sfdir);
            ioProvider.getOut().append(" ").append(sfdir);
        }

        ioProvider.getOut().append(" )\n");
        
        int retVal = csound.compile(argsList.toArray(new String[0]));

        if (retVal != 0) {
            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
            csound.stop();
            csound.cleanup();
            csound.setMessageCallback(null);
            csound.reset();
            return;
        }

        int updateRate = (int) (csound.getKr()
                / PlaybackSettings.getInstance().getPlaybackFPS());
        int counter = 0;

        RenderTimeManager manager = Lookup.getDefault().lookup(
                RenderTimeManager.class);
        manager.initiateRender(startTime);

        Parameter param;


        do {
            counter++;

            double scoreTime = csound.getScoreTime();

            if (counter > updateRate) {
                manager.updateTimePointer(scoreTime);
                counter = 0;
            }

            double currentTime = 0.0f;

            if (startTime >= 0.0f) {
                if (mapper != null) {
                    double renderStartSeconds = mapper.beatsToSeconds(startTime);
                    currentTime = mapper.secondsToBeats(
                            scoreTime + renderStartSeconds);
                    currentTime -= startTime;
                } else {
                    currentTime = startTime + scoreTime;
                }
            }


            if (parameters != null) {
                for (int i = 0; i < parameters.size(); i++) {
                    param = parameters.get(i);
                    String varName = param.getCompilationVarName();

                    double value = param.getValue(currentTime);
                    csound.setChannel(varName, value);

                }
            }
        } while (csound.performKsmps() == 0 && keepRunning);
        csound.stop();
        csound.cleanup();
        csound.setMessageCallback(null);
        csound.reset();


        manager.endRender();

        keepRunning = false;

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);

    }

    @Override
    public void execWait(String[] args,
            File currentWorkingDirectory,
            double startTime,
            TempoMapper mapper,
            ArrayList<Parameter> parameters) {
        initialize();
        exec(args, currentWorkingDirectory, startTime, mapper, parameters);
    }

    @Override
    public String execWaitAndCollect(String[] args,
            File currentWorkingDirectory) {
        initialize();

        Csound csound = new Csound();
        blueCallbackWrapper = new BlueCallbackWrapper();
        csound.setMessageCallback(blueCallbackWrapper);
        
        StringBuilder buffer = new StringBuilder();
        blueCallbackWrapper.setStringBuffer(buffer);

        var argsList = new ArrayList<String>();

        for (int i = 0; i < args.length; i++) {
            if (args[i].startsWith("\"") && args[i].endsWith("\"")) {
                args[i] = args[i].substring(1, args[i].length() - 1);
            }
            argsList.add(args[i]);
        }
        
        if (currentWorkingDirectory != null) {
            String sfdir = "--env:SFDIR=" + currentWorkingDirectory.getAbsolutePath();
            argsList.add(sfdir);
        }

        int retVal = csound.compile(argsList.toArray(new String[0]));

        if (retVal != 0) {
            blueCallbackWrapper.setStringBuffer(null);
            csound.stop();
            csound.cleanup();
            csound.setMessageCallback(null);
            csound.reset();
            return buffer.toString();
        }


        while (csound.performKsmps() == 0 && keepRunning) {
            // empty
        }
        csound.stop();
        csound.cleanup();
        csound.setMessageCallback(null);
        csound.reset();

        keepRunning = false;

        blueCallbackWrapper.setStringBuffer(null);

        return buffer.toString();
    }

    @Override
    public void stop() {
        keepRunning = false;
    }

    public void addPlayModeListener(PlayModeListener listener) {
        listeners.add(listener);
    }

    public void removePlayModeListener(PlayModeListener listener) {
        listeners.remove(listener);
    }

    public void notifyPlayModeListeners(int playMode) {
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PlayModeListener listener = (PlayModeListener) iter.next();
            listener.playModeChanged(playMode);
        }
    }

    /**
     *
     * @param data
     * @return the absolute path of the temp CSD file on disk
     */
    protected String generateCsd(BlueData data) {

        double startTime = data.getRenderStartTime();
        double endTime = data.getRenderEndTime();

        if (data.getProjectProperties().diskAlwaysRenderEntireProject) {
            startTime = 0.0f;
            endTime = -1.0f;
        }


        CsdRenderResult result;
        try {
            result = CSDRenderService.getDefault().generateCSD(
                    data, startTime,
                    endTime, false, true);
        } catch (ScoreGenerationException ex) {
            Exceptions.printStackTrace(ex);
            return null;
        }

        String csd = result.getCsdText();

        File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                BlueSystem.getCurrentProjectDirectory(), csd);

        return temp.getAbsolutePath();
    }

    @Override
    @SuppressWarnings("empty-statement")
    public void renderToDisk(DiskRenderJob job) {

        String csdPath = generateCsd(job.getData());

        if (csdPath == null) {
            return;
        }

        initialize();

        Csound csound = new Csound();
        blueCallbackWrapper = new BlueCallbackWrapper();
        csound.setMessageCallback(blueCallbackWrapper);
        final InputOutput ioProvider = IOProvider.getDefault().
                getIO("Csound (Disk)", false);

        try {
            ioProvider.getOut().reset();
        } catch (IOException ex) {
            Exceptions.printStackTrace(ex);
        }

        IOColors.setColor(ioProvider, IOColors.OutputType.OUTPUT, Color.WHITE);
        blueCallbackWrapper.setInputOutput(ioProvider);

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_PLAY);

        var argsList = new ArrayList<String>();
        ioProvider.getOut().append("Render Command (");

        String[] args = job.getArgs();
        for (int i = 0; i < args.length; i++) {
            if (args[i].startsWith("\"") && args[i].endsWith("\"")) {
                args[i] = args[i].substring(1, args[i].length() - 1);
            }
            argsList.add(args[i]);
            ioProvider.getOut().append(" ").append(args[i]);
        }

        if (job.getCurrentWorkingDirectory() != null) {
            String sfdir = "--env:SFDIR=" + job.getCurrentWorkingDirectory().getAbsolutePath();
            argsList.add(sfdir);
            ioProvider.getOut().append(" ").append(sfdir);
        }

        argsList.add(csdPath);

        ioProvider.getOut().append(" " + csdPath + " )\n");

        int retVal = csound.compile(argsList.toArray(new String[0]));

        if (retVal != 0) {
            notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
            csound.stop();
            csound.cleanup();
            csound.setMessageCallback(null);
            csound.reset();
            return;
        }

        while (csound.performKsmps() == 0 && keepRunning) {
            
        }
        csound.stop();
        csound.cleanup();
        csound.setMessageCallback(null);
        csound.reset();

        keepRunning = false;

        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);


    }

    @Override
    public int getCsoundVersion(String csoundCommand) {
        return 6;
    }
}
