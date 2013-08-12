/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.render;

import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.event.PlayModeListener;
import blue.gui.ExceptionDialog;
import blue.mixer.Mixer;
import blue.services.render.RealtimeRenderService;
import blue.services.render.RealtimeRenderServiceFactory;
import blue.settings.RealtimeRenderSettings;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.utility.ObjectUtilities;
import java.util.ArrayList;
import org.openide.awt.StatusDisplayer;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public final class RealtimeRenderManager {

    private boolean looping = false;
    private static RealtimeRenderManager instance = null;
    private ArrayList<PlayModeListener> listeners = new ArrayList<PlayModeListener>();
    private ArrayList<PlayModeListener> blueLiveListeners = new ArrayList<PlayModeListener>();
    private RealtimeRenderServiceFactory currentRenderServiceFactory = null;
    private RealtimeRenderService currentRenderService = null;
    private RealtimeRenderService currentBlueLiveRenderService = null;
    private PlayModeListener realtimeListener;
    private PlayModeListener blueLiveListener;
    private boolean auditioning = false;

    private RealtimeRenderManager() {
        realtimeListener = new PlayModeListener() {
            @Override
            public void playModeChanged(int playMode) {
                if(playMode == PlayModeListener.PLAY_MODE_STOP) {
                    auditioning = false;
                }
                for (PlayModeListener listener : listeners) {
                    listener.playModeChanged(playMode);
                }
            }
        };
        blueLiveListener = new PlayModeListener() {
            @Override
            public void playModeChanged(int playMode) {
                for (PlayModeListener listener : blueLiveListeners) {
                    listener.playModeChanged(playMode);
                }
            }
        };
    }

    public static RealtimeRenderManager getInstance() {
        if (instance == null) {
            instance = new RealtimeRenderManager();
        }
        return instance;
    }

    public void addPlayModeListener(PlayModeListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removePlayModeListener(PlayModeListener listener) {
        listeners.remove(listener);
    }

    public void addBlueLivePlayModeListener(PlayModeListener listener) {
        if (!blueLiveListeners.contains(listener)) {
            blueLiveListeners.add(listener);
        }
    }

    public void removeBlueLivePlayModeListener(PlayModeListener listener) {
        blueLiveListeners.remove(listener);
    }

    public void renderProject(BlueData data) { 
        this.renderProject(data, false);
    }

    protected void renderProject(BlueData data, boolean auditioning) {

        if (isRendering()) {
            stopRendering();
        }

        if (data == null) {
            this.auditioning = false;
            return;
        }


        this.auditioning = auditioning;

        StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                "message.generatingCSD"));

        RealtimeRenderServiceFactory factory = RealtimeRenderSettings.getInstance().renderServiceFactory;

        if (currentRenderServiceFactory != factory
                || currentRenderService == null
                || currentRenderService.getClass() != factory.getRenderServiceClass()) {
            if (currentRenderService != null) {
                currentRenderService.removePlayModeListener(realtimeListener);
            }
            currentRenderServiceFactory = factory;
            currentRenderService = factory.createInstance();
            currentRenderService.addPlayModeListener(realtimeListener);
        }

        currentRenderService.setData(data);
        try {
            currentRenderService.render();
        } catch (SoundObjectException soe) {
            ExceptionDialog.showExceptionDialog(
                    WindowManager.getDefault().getMainWindow(),
                    soe);
        }
    }

    public void renderForBlueLive(BlueData data) {

        if (currentBlueLiveRenderService != null && currentBlueLiveRenderService.isRunning()) {
            currentBlueLiveRenderService.stop();
        }

        if (data == null) {
            return;
        }

        StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                "message.generatingCSD"));

        RealtimeRenderServiceFactory factory = RealtimeRenderSettings.getInstance().renderServiceFactory;

        if (currentRenderServiceFactory != factory
                || currentBlueLiveRenderService == null
                || currentBlueLiveRenderService.getClass() != factory.getRenderServiceClass()) {
            if (currentBlueLiveRenderService != null) {
                currentBlueLiveRenderService.removePlayModeListener(blueLiveListener);
            }
            currentRenderServiceFactory = factory;
            currentBlueLiveRenderService = factory.createInstance();
            currentBlueLiveRenderService.addPlayModeListener(blueLiveListener);
        }

        currentBlueLiveRenderService.setData(data);
        try {
            currentBlueLiveRenderService.renderForBlueLive();
        } catch (SoundObjectException soe) {
            ExceptionDialog.showExceptionDialog(
                    WindowManager.getDefault().getMainWindow(),
                    soe);
        }

    }

    public void auditionSoundObjects(BlueData data, SoundObject[] soundObjects) {

        if (soundObjects == null || soundObjects.length == 0) {
            return;
        }
       
        if (isRendering()) {
            stopRendering();
        }
        
        BlueData tempData = (BlueData) ObjectUtilities.clone(data);

        PolyObject tempPObj = new PolyObject(true);
        SoundLayer sLayer = (SoundLayer)tempPObj.newLayerAt(-1);

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

        tempData.getScore().clearLayerGroups();
        tempData.getScore().addLayerGroup(tempPObj);

        Mixer m = tempData.getMixer();

        if (m.isEnabled()) {
            maxTime += m.getExtraRenderTime();
        }

        tempData.setRenderStartTime(minTime);
        tempData.setRenderEndTime(maxTime);

        renderProject(tempData, true);
    }
    
    public void stopRendering() {
        if (isRendering()) {
            currentRenderService.stop();
            realtimeListener.playModeChanged(PlayModeListener.PLAY_MODE_STOP);
        }
    }

    public void stopBlueLiveRendering() {
        if (isBlueLiveRendering()) {
            currentBlueLiveRenderService.stop();
            blueLiveListener.playModeChanged(PlayModeListener.PLAY_MODE_STOP);
        }
    }

    public void stopAuditioning() {
        if (isAuditioning()) {
            stopRendering();
        } 
    }

    public boolean isAuditioning() {
        return (isRendering() && auditioning);
    }
    
    public boolean isRendering() {
        return (currentRenderService != null && currentRenderService.isRunning());
    }

    public boolean isBlueLiveRendering() {
        return (currentBlueLiveRenderService != null && currentBlueLiveRenderService.isRunning());
    }

    public void passToStdin(String score) {
        if (isBlueLiveRendering()) {
            currentBlueLiveRenderService.passToStdin(score);
        }
    }
}
