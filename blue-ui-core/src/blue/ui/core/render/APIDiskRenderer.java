package blue.ui.core.render;

import java.io.File;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;


import org.apache.commons.lang.text.StrBuilder;

import blue.automation.Parameter;
import blue.event.PlayModeListener;
import blue.noteProcessor.TempoMapper;
import blue.settings.PlaybackSettings;
import csnd.Csound;
import csnd.CsoundArgVList;
import csnd.csnd;
import java.awt.Color;
import java.io.IOException;
import org.openide.util.Exceptions;
import org.openide.windows.IOColors;
import org.openide.windows.IOProvider;
import org.openide.windows.InputOutput;

public class APIDiskRenderer {

    Vector listeners = new Vector();
    
    RenderTimeManager renderTimeManager = null;
    
    private volatile boolean keepRunning = false;

    private static APIDiskRenderer instance = null;
    
    public static APIDiskRenderer getInstance() {
        if(instance == null) {
            instance = new APIDiskRenderer();
        }
        return instance;
    }
    
    private APIDiskRenderer() {
        
    }
    
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
            float startTime,
            TempoMapper mapper,
            ArrayList parameters) {

        csnd.csoundInitialize(null, null, csnd.CSOUNDINIT_NO_SIGNAL_HANDLER);
        Csound csound = new Csound();
        BlueCallbackWrapper blueCallbackWrapper = new BlueCallbackWrapper(csound);
        blueCallbackWrapper.SetMessageCallback();
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
        
        CsoundArgVList argsList = new CsoundArgVList();      
        
        for (int i = 0; i < args.length; i++) {
            argsList.Append(args[i]);
        }
        
        int retVal = csound.Compile(argsList.argc(), argsList.argv());

        if (retVal != 0) {
           notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);
           csound.Stop();
           csound.SetMessageCallback(null);
           csound.SetHostData(null);
           csound.Reset();
           return;
        }
        
        int updateRate = (int) (csound.GetKr() /
                PlaybackSettings.getInstance().getPlaybackFPS());
        int counter = 0;
        
        RenderTimeManager manager = RenderTimeManager.getInstance();
        manager.initiateRender(startTime);
        
        Parameter param;
        
        
        do {
            counter++;

            float scoreTime = (float) csound.GetScoreTime();

            if (counter > updateRate) {
                manager.updateTimePointer(scoreTime);     
                counter = 0;
            }

            float currentTime = 0.0f;

            if(startTime >= 0.0f) {
                if (mapper != null) {
                    float renderStartSeconds = mapper.beatsToSeconds(startTime);
                    currentTime = mapper.secondsToBeats(scoreTime + renderStartSeconds);
                    currentTime -= startTime;
                } else {
                    currentTime = startTime + scoreTime;
                }
            }

                       
            if(parameters != null) {
                for (int i = 0; i < parameters.size(); i++) {
                    param = (Parameter) parameters.get(i);
                    String varName = param.getCompilationVarName();
                
                    float value = param.getValue(currentTime);
                    csound.SetChannel(varName, (double) value);
                    
                }
            }
        } while (csound.PerformKsmps() == 0 && keepRunning);
        csound.Stop();
        csound.SetMessageCallback(null);
        csound.SetHostData(null);
        csound.Reset();
        
        RenderTimeManager.getInstance().endRender();
        
        keepRunning = false;
        
        notifyPlayModeListeners(PlayModeListener.PLAY_MODE_STOP);

    }

    public void execWait(String[] args,
            File currentWorkingDirectory, 
            float startTime,
            TempoMapper mapper,
            ArrayList parameters) {
        initialize();
//        Csound csound = new Csound();
//        BlueCallbackWrapper blueCallbackWrapper = new BlueCallbackWrapper(csound);
//        blueCallbackWrapper.SetMessageCallback();
        
//        if (GeneralSettings.getInstance().isShowCsoundOutputEnabled()) {
//            blueCallbackWrapper.setInputOutput(IOProvider.getDefault().getIO("Csound", false));
//        } else {
//            blueCallbackWrapper.setInputOutput(null);
//        }
        
        exec(args, currentWorkingDirectory, startTime, mapper, parameters);

//        blueCallbackWrapper.setInputOutput(null);
    }

    public String execWaitAndCollect(String[] args,
            File currentWorkingDirectory) {
        initialize();
        csnd.csoundInitialize(null, null, csnd.CSOUNDINIT_NO_SIGNAL_HANDLER);
        Csound csound = new Csound();
        BlueCallbackWrapper blueCallbackWrapper = new BlueCallbackWrapper(csound);
        blueCallbackWrapper.SetMessageCallback();

        StrBuilder buffer = new StrBuilder();
        blueCallbackWrapper.setStringBuffer(buffer);

        CsoundArgVList argsList = new CsoundArgVList();      
        
        for (int i = 0; i < args.length; i++) {
            argsList.Append(args[i]);
        }
        
        int retVal = csound.Compile(argsList.argc(), argsList.argv());

        if (retVal != 0) {
            blueCallbackWrapper.setStringBuffer(null);
            csound.Stop();
            csound.SetMessageCallback(null);
            csound.SetHostData(null);
            csound.Reset();
            return buffer.toString();
        }
               
        
        while (csound.PerformKsmps() == 0 && keepRunning) {
            // empty
        }
        csound.Stop();
        csound.SetMessageCallback(null);
        csound.SetHostData(null);
        csound.Reset();
        
        keepRunning = false;
        
        blueCallbackWrapper.setStringBuffer(null);
        
        return buffer.toString();
    }
    
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

}
