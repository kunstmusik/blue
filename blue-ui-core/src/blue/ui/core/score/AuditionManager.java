/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score;

import blue.ui.core.render.CsdRenderResult;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.StringTokenizer;

import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.automation.Parameter;
import blue.event.PlayModeListener;
import blue.mixer.Mixer;
import blue.noteProcessor.TempoMapper;
import blue.ui.core.render.APIDiskRenderer;
import blue.ui.core.render.CSDRender;
import blue.ui.core.render.RenderTimeManager;
import blue.score.tempo.Tempo;
import blue.settings.GeneralSettings;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.ui.core.render.ProcessConsole;
import blue.utility.APIUtilities;
import blue.utility.FileUtilities;
import blue.utility.ObjectUtilities;
import blue.utility.ProjectPropertiesUtil;
import blue.utility.TextUtilities;
import org.openide.awt.StatusDisplayer;

public class AuditionManager {

    private static AuditionManager audition = null;

    ArrayList<PlayModeListener> listeners = new ArrayList<PlayModeListener>();

    ProcessConsole pConsole = new ProcessConsole();

    private blue.ui.core.score.AuditionManager.RunProxy runProxy;
    
    PlayModeListener pml;
    
    private AuditionManager() {
        pml = new PlayModeListener() {

            public void playModeChanged(int playMode) {
                notifyPlayModeListeners(playMode);
            }

        };
        pConsole.addPlayModeListener(pml);
        
    }

    public static AuditionManager getInstance() {
        if (audition == null) {
            audition = new AuditionManager();
        }
        return audition;
    }

    public void auditionSoundObjects(BlueData data, SoundObject[] soundObjects) {

        BlueData tempData = (BlueData) ObjectUtilities.clone(data);

        PolyObject tempPObj = new PolyObject(true);
        SoundLayer sLayer = tempPObj.newSoundLayer();

        if (soundObjects.length < 1) {
            return;
        }

        float minTime = Float.MAX_VALUE;
        float maxTime = Float.MIN_VALUE;

        for (int i = 0; i < soundObjects.length; i++) {
            SoundObject sObj = soundObjects[i];
            float startTime = sObj.getStartTime();
            float endTime = startTime + sObj.getSubjectiveDuration();

            if (startTime < minTime) {
                minTime = startTime;
            }

            if (endTime > maxTime) {
                maxTime = endTime;
            }

            sLayer.addSoundObject((SoundObject) sObj.clone());
        }

        tempData.setPolyObject(tempPObj);

        Mixer m = tempData.getMixer();

        if (m.isEnabled()) {
            maxTime += m.getExtraRenderTime();
        }

        tempData.setRenderStartTime(minTime);
        tempData.setRenderEndTime(maxTime);

        String tempCSD;
        CsdRenderResult result;

        try {
            result = CSDRender.generateCSD(tempData, minTime, maxTime, true);
            tempCSD = result.getCsdText();
        } catch (SoundObjectException e) {
//            ExceptionDialog.showExceptionDialog(null, e);
            throw new RuntimeException("CSDRender Failed");
        }

        String command = ProjectPropertiesUtil.getRealtimeCommandLine(
                data.getProjectProperties());

        try {

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

            RenderTimeManager timeManager = RenderTimeManager.getInstance();
            timeManager.setTempoMapper(tempoMapper);
            timeManager.setRootPolyObject(data.getPolyObject());

            File projectDir = BlueSystem.getCurrentProjectDirectory();

            File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                    projectDir, tempCSD);

            
            if (APIUtilities.isCsoundAPIAvailable() && 
                    GeneralSettings.getInstance().isUsingCsoundAPI()) {
                String[] args = command.split("\\s+");
                String[] args2 = new String[args.length + 1];
                System.arraycopy(args, 0, args2, 0, args.length);
                args2[args.length] = temp.getAbsolutePath();
                                
                play(args2, 
                        BlueSystem.getCurrentProjectDirectory(), 
                        data, minTime, tempoMapper, result.getParameters());
                
            } else {
                command += " \"" + temp.getAbsolutePath() + "\"";
                play(command, BlueSystem.getCurrentProjectDirectory(), minTime);
            }
                        

        } catch (Exception ex) {
            System.err.println("[" + BlueSystem.getString("message.error")
                    + "] " + ex.getLocalizedMessage());
            ex.printStackTrace();
        }
    }

    public void stop() {
        if (isRunning() && runProxy != null) {
            runProxy.stop();
        }
    }

    private TempoMapper getTempoMapper(String globalSco) {
        TempoMapper mapper = null;

        StringTokenizer st = new StringTokenizer(globalSco, "\n");

        while (st.hasMoreTokens()) {
            String temp = st.nextToken().trim();

            if (temp.startsWith("t")) {
                mapper = TempoMapper.createTempoMapper(temp.substring(1));
            }

        }

        return mapper;
    }

    public void play(String command, File currentWorkingDirectory,
            float renderStart) {        
        runProxy = new RunProxy(command, currentWorkingDirectory, renderStart);
        new Thread(runProxy).start();
    }
    
    public void play(String[] args, File currentWorkingDirectory,
            BlueData blueData, float renderStart, TempoMapper mapper,
            ArrayList<Parameter> parameters) {
        runProxy = new RunProxy(args, currentWorkingDirectory, blueData,
                renderStart, mapper, parameters);
        new Thread(runProxy).start();

    }

    public boolean isRunning() {
        return (pConsole.isRunning() || (runProxy != null && runProxy.isRunning()));
    }

    public void addPlayModeListener(PlayModeListener listener) {
        listeners.add(listener);
    }

    public void removePlayModeListener(PlayModeListener listener) {
        listeners.remove(listener);
    }

    public void notifyPlayModeListeners(int playMode) {
        if (playMode == PlayModeListener.PLAY_MODE_PLAY) {
            StatusDisplayer.getDefault().setStatusText("Auditioning SoundObjects...");
        } 
        
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PlayModeListener listener = (PlayModeListener) iter.next();
            listener.playModeChanged(playMode);
        }
    }

    class RunProxy implements Runnable {
        String command = null;
        String[] args = null;

        File currentWorkingDirectory;

        private float renderStart;
        private ArrayList<Parameter> parameters = null;
        private BlueData blueData;
        private TempoMapper mapper;
        
        APIDiskRenderer apiDiskRenderer = new APIDiskRenderer();

        public RunProxy(String command, File currentWorkingDirectory,
                float renderStart) {
            this.command = command;
            this.currentWorkingDirectory = currentWorkingDirectory;
            this.renderStart = renderStart;
        }
        
        public RunProxy(String[] args, File currentWorkingDirectory,
                BlueData blueData, float renderStart, TempoMapper mapper, ArrayList<Parameter> parameters) {
            this.args = args;
            this.currentWorkingDirectory = currentWorkingDirectory;
            this.blueData = blueData;
            this.renderStart = renderStart;
            this.mapper = mapper;
            this.parameters = parameters;
        }
        
        public boolean isRunning() {
            return apiDiskRenderer.isRunning();
        }

        public void run() {
            RenderTimeManager manager = RenderTimeManager.getInstance();
            manager.initiateRender(renderStart);
            
            try {
                if(command != null) {
                    pConsole.setRenderTimeManager(manager);
                    pConsole.execWait(command, currentWorkingDirectory);
                } else {
                   
                    apiDiskRenderer.addPlayModeListener(pml);
                    apiDiskRenderer.setRenderTimeManager(manager);
                    apiDiskRenderer.execWait(args, 
                            currentWorkingDirectory, 
                            this.renderStart,
                            this.mapper,
                            this.parameters);
                }
            } catch (IOException ioe) {
                stop();
                System.err.println("[error] - " + ioe.getLocalizedMessage());
            }
        }

        public void stop() {
            if (pConsole != null && command != null) {
                pConsole.destroy(false, true);
            } else if (args != null) {
                apiDiskRenderer.stop();
            }
            
        }
    }

}
