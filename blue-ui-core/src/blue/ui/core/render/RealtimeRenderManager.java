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
import blue.event.PlayModeListener;
import blue.gui.ExceptionDialog;
import blue.mixer.Mixer;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.ScoreObjectLayer;
import blue.score.layers.ScoreObjectLayerGroup;
import blue.services.render.CsoundBinding;
import blue.services.render.RealtimeRenderService;
import blue.services.render.RealtimeRenderServiceFactory;
import blue.settings.RealtimeRenderSettings;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openide.awt.StatusDisplayer;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public final class RealtimeRenderManager {

    private boolean looping = false;
    private static RealtimeRenderManager instance = null;
    private ArrayList<PlayModeListener> listeners = new ArrayList<>();
    private ArrayList<PlayModeListener> blueLiveListeners = new ArrayList<>();
    private RealtimeRenderServiceFactory currentRenderServiceFactory = null;
    private RealtimeRenderService currentRenderService = null;
    private RealtimeRenderService currentBlueLiveRenderService = null;
    private PlayModeListener realtimeListener;
    private PlayModeListener blueLiveListener;
    private boolean auditioning = false;
    private boolean shuttingDown = false;

    private RealtimeRenderManager() {
        realtimeListener = (int playMode) -> {
            if (shuttingDown) {
                return;
            }
            if (playMode == PlayModeListener.PLAY_MODE_STOP) {
                auditioning = false;
            }
            for (PlayModeListener listener : listeners) {
                listener.playModeChanged(playMode);
            }
        };
        blueLiveListener = (int playMode) -> {
            if (shuttingDown) {
                return;
            }
            for (PlayModeListener listener : blueLiveListeners) {
                listener.playModeChanged(playMode);
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

        currentBlueLiveRenderService.addBinding(new BlueLiveBinding(data));
        currentBlueLiveRenderService.setData(data);
        try {
            currentBlueLiveRenderService.renderForBlueLive();
        } catch (SoundObjectException soe) {
            ExceptionDialog.showExceptionDialog(
                    WindowManager.getDefault().getMainWindow(),
                    soe);
        }

    }

    public void addBlueLiveBinding(CsoundBinding binding) {
        if (currentBlueLiveRenderService != null) {
            currentBlueLiveRenderService.addBinding(binding);
        }
    }

    protected void filterScore(Score score, List<ScoreObject> scoreObjects) {
        Iterator<LayerGroup<? extends Layer>> iter = score.iterator();

        Set<Integer> cloneSources = scoreObjects.stream()
                .mapToInt(Object::hashCode)
                .boxed()
                .collect(Collectors.toSet());

        while(iter.hasNext()) {
            LayerGroup<? extends Layer> lg = iter.next();
            if(lg instanceof ScoreObjectLayerGroup) {
               ScoreObjectLayerGroup<? extends ScoreObjectLayer> slg =  
                       (ScoreObjectLayerGroup<? extends ScoreObjectLayer>) lg; 
               
                Iterator<? extends ScoreObjectLayer<? extends ScoreObject>> layerIter 
                        = slg.iterator();

                while(layerIter.hasNext()) {
                   ScoreObjectLayer<? extends ScoreObject> layer = layerIter.next();

                   layer.removeIf(s -> !cloneSources.contains(s.getCloneSourceHashCode()));

                   if(layer.isEmpty()) {
                       layerIter.remove();
                   } else {
                       layer.setSolo(false);
                       layer.setMuted(false);
                   }
                }
                if(slg.isEmpty()) {
                    iter.remove();
                }                
            } else {
                iter.remove();
            }
        }
    }

    public void auditionSoundObjects(BlueData data, List<ScoreObject> scoreObjects) {

        if (scoreObjects == null || scoreObjects.isEmpty()) {
            return;
        }

        if (isRendering()) {
            stopRendering();
        }

        BlueData tempData = new BlueData(data);
        tempData.setLoopRendering(false);

        List<PolyObject> path = null;
        filterScore(tempData.getScore(), scoreObjects);

        if(data.getScore().isEmpty()) {
            throw new RuntimeException("Error: unable to find root LayerGroups for objects...");
        } 

        double minTime = Double.MAX_VALUE;
        double maxTime = Double.MIN_VALUE;

        for (ScoreObject sObj : scoreObjects) {
            double startTime = sObj.getStartTime();
            double endTime = startTime + sObj.getSubjectiveDuration();

            if (startTime < minTime) {
                minTime = startTime;
            }

            if (endTime > maxTime) {
                maxTime = endTime;
            }

        }

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

    public void evalOrc(String orchestra) {
        if (isBlueLiveRendering()){
            currentBlueLiveRenderService.evalOrc(orchestra);
        }
    }

    public void shutdown() {
        shuttingDown = true;
        stopRendering();
        stopBlueLiveRendering();
    }

    private List<PolyObject> getPolyObjectPath(PolyObject pObj, SoundObject soundObject) {
        List<SoundObject> allSObj = pObj.getSoundObjects(true);
        List<PolyObject> retVal = null;
        if (allSObj.contains(soundObject)) {
            retVal = new ArrayList<>();
            retVal.add(pObj);
        } else {
            List<SoundObject> pObjs = allSObj.stream().
                    filter(a -> a instanceof PolyObject).
                    collect(Collectors.toList());
            for(SoundObject obj : pObjs) {
                PolyObject tempPObj = (PolyObject)obj;
                retVal = getPolyObjectPath(tempPObj, soundObject);
                if(retVal != null) {
                    retVal.add(0, pObj);
                    break;
                }
            }
        }

        return retVal;
    }
}
