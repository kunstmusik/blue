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
package blue.ui.core.score.object.actions;

import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.mixer.Mixer;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.settings.UtilitySettings;
import blue.soundObject.FrozenSoundObject;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.render.DiskRenderManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.utility.FileUtilities;
import blue.utility.ObjectUtilities;
import blue.utility.SoundFileUtilities;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JOptionPane;
import org.netbeans.api.progress.ProgressHandle;
import org.netbeans.api.progress.ProgressRunnable;
import org.netbeans.api.progress.ProgressUtils;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.FreezeUnfreezeAction")
@ActionRegistration(
        displayName = "#CTL_FreezeUnfreezeAction")
@Messages("CTL_FreezeUnfreezeAction=Freeze/Unfreeze ScoreObjects")
@ActionReference(path = "blue/score/actions", position = 30, separatorAfter = 35)
public final class FreezeUnfreezeAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;
    private final Point p;
    private final ScorePath scorePath;

    public FreezeUnfreezeAction() {
        this(Utilities.actionsGlobalContext());
    }

    public FreezeUnfreezeAction(Lookup lookup) {
        super(NbBundle.getMessage(FreezeUnfreezeAction.class,
                "CTL_FreezeUnfreezeAction"));
        this.scoreObjects = lookup.lookupAll(ScoreObject.class);
        this.soundObjects = lookup.lookupAll(SoundObject.class);
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        List<Layer> allLayers = scorePath.getAllLayers();
        List<SoundObject> sObjList = new ArrayList<>(soundObjects);
        List<Layer> layers = new ArrayList<>();

        for (SoundObject sObj : sObjList) {
            for (Layer layer : allLayers) {
                if (layer.contains(sObj)) {
                    layers.add(layer);
                    break;
                }
            }
        }

        if (layers.size() != sObjList.size()) {
            throw new RuntimeException(
                    "Error: Could not find layers for selected SoundObjects");
        }

        ProgressUtils.showProgressDialogAndRun(
                new FreezeRunnable(sObjList, layers),
                "Freeze/Unfreeze SoundObjects", true);

    }

    @Override
    public boolean isEnabled() {
        return !soundObjects.isEmpty() && soundObjects.size() == scoreObjects.size();
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new FreezeUnfreezeAction(actionContext);
    }

    static class FreezeRunnable implements ProgressRunnable<Void> {

        private List<SoundObject> soundObjects;
        private List<Layer> layers;

        public FreezeRunnable(List<SoundObject> soundObjects, List<Layer> layers) {
            this.soundObjects = soundObjects;
            this.layers = layers;
        }

        @Override
        public Void run(ProgressHandle handle) {

            handle.switchToDeterminate(soundObjects.size());

            for (int i = 0; i < soundObjects.size(); i++) {
                SoundObject sObj = soundObjects.get(i);
                SoundLayer layer = (SoundLayer) layers.get(i);

                if (sObj instanceof FrozenSoundObject) {
                    handle.progress("Unfreezing SoundObject...", i);
                    FrozenSoundObject frozenObj = (FrozenSoundObject) sObj;

                    layer.remove(sObj);
                    
                    unfreezeSoundObject(frozenObj);

                    SoundObject source = frozenObj.getFrozenSoundObject();
                    source.setStartTime(frozenObj.getStartTime());
                    layer.add(source);
                    
                } else {
                    handle.progress("Freezing SoundObject...", i);
                    SoundObject frozenObj = freezeSoundObject(sObj);
                    if (frozenObj == null) {
                        return null;
                    }
                    frozenObj.setStartTime(sObj.getStartTime());

                    layer.remove(sObj);
                    layer.add(frozenObj);
                }

            }

            handle.finish();

            return null;
        }

        /**
         * @param sObj
         */
        protected FrozenSoundObject freezeSoundObject(SoundObject sObj) {
            File projectDir = BlueSystem.getCurrentProjectDirectory();

            if (projectDir == null) {
                JOptionPane.showMessageDialog(null,
                        "Project must be saved before soundObjects can be frozen.");
                return null;
            }

            BlueData data = BlueProjectManager.getInstance().getCurrentProject().getData();
            BlueData tempData = (BlueData) ObjectUtilities.clone(data);

            PolyObject tempPObj = new PolyObject(true);
            SoundLayer sLayer = tempPObj.newLayerAt(-1);

            SoundObject tempSObj = (SoundObject) sObj.clone();
            tempData.setRenderStartTime(tempSObj.getStartTime());

            float renderEndTime = tempSObj.getStartTime() + tempSObj.getSubjectiveDuration();
            Mixer m = data.getMixer();

            if (m.isEnabled()) {
                renderEndTime += m.getExtraRenderTime();
            }

            tempData.setRenderEndTime(renderEndTime);

            sLayer.add(tempSObj);

            tempData.getScore().clearLayerGroups();
            tempData.getScore().addLayerGroup(tempPObj);

            String tempCSD;
            CsdRenderResult result;

            try {
                result = CSDRenderService.getDefault().generateCSD(tempData,
                        tempSObj.getStartTime(), renderEndTime, false, false);
                tempCSD = result.getCsdText();
            } catch (Exception e) {
//                ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
//                        e);
                throw new RuntimeException("CSDRender Failed", e);
            }

            String tempFileName = getAvailableFreezeFileName(projectDir);
            String fullTempFileName = projectDir.getAbsolutePath() + File.separatorChar + tempFileName;

            System.out.println("TEMP FILE NAME: " + tempFileName);

            String csoundExec;
            final UtilitySettings utilitySettings = UtilitySettings.getInstance();

            csoundExec = utilitySettings.csoundExecutable;

            String flags = utilitySettings.freezeFlags;

            String command = csoundExec + " " + flags + " ";

            try {
                // float tempStart;

                File temp = FileUtilities.createTempTextFile("tempCsd", ".csd",
                        projectDir, tempCSD);

                String[] args = command.split("\\s+");
                String[] args2 = new String[args.length + 2];
                System.arraycopy(args, 0, args2, 0, args.length);
                args2[args.length] = fullTempFileName;
                args2[args.length + 1] = temp.getAbsolutePath();

                String csoundOutput = DiskRenderManager.getInstance()
                        .execWaitAndCollect(args2, projectDir);

                FrozenSoundObject fso = new FrozenSoundObject();

                fso.setFrozenSoundObject(sObj);
                fso.setFrozenWaveFileName(tempFileName);
                fso.setName("F: " + sObj.getName());

                float soundFileDuration = SoundFileUtilities.getDurationInSeconds(
                        fullTempFileName);

                fso.setSubjectiveDuration(soundFileDuration);

                int numChannels = SoundFileUtilities.getNumberOfChannels(
                        fullTempFileName);

                fso.setNumChannels(numChannels);

//                replaceSoundObject(sObj, fso, false, false);
                return fso;

            } catch (Exception ex) {
                System.err.println(
                        "[" + BlueSystem.getString("message.error") + "] " + ex.getLocalizedMessage());
                ex.printStackTrace();
            }

            return null;
        }

        private String getAvailableFreezeFileName(File projectDir) {
            String[] files = projectDir.list();

            int counter = -1;

            for (int i = 0; i < files.length; i++) {
                if (files[i].startsWith("freeze")) {
                    try {
                        int num = Integer.parseInt(files[i].substring(6,
                                files[i].indexOf(".")));
                        if (counter < num) {
                            counter = num;
                        }
                    } catch (NumberFormatException nfe) {
                        // just continue on
                    }
                }
            }

            counter++;

            String extension = ".wav";

            if (System.getProperty("os.name").indexOf("Mac") >= 0) {
                extension = ".aif";
            }

            String tempFileName = "freeze" + counter + extension;

            while (new File(tempFileName).exists()) {
                counter++;
                tempFileName = "freeze" + counter + extension;
            }

            return tempFileName;
        }

        protected void unfreezeSoundObject(FrozenSoundObject fso) {

            //replaceSoundObject(fso, fso.getFrozenSoundObject(), false, false);
            String waveFileName = fso.getFrozenWaveFileName();

            int refCount = freezeReferenceCount(
                    ScoreController.getInstance().getScore(),
                    waveFileName);

            System.out.println("Reference Count: " + refCount);

            if (refCount <= 0) {
                File projectDir = BlueSystem.getCurrentProjectDirectory();
                File f = new File(projectDir, waveFileName);
                f.delete();

                System.out.println("Deleting File: " + f.getAbsolutePath());
            }
        }

        private int freezeReferenceCount(Score score, String waveFileName) {
            int retVal = 0;

            for (int i = 0; i < score.getLayerGroupCount(); i++) {

                LayerGroup lGroup = score.getLayerGroup(i);

                if (lGroup instanceof PolyObject) {

                    PolyObject pObj = (PolyObject) lGroup;
                    retVal += freezeReferenceCount(pObj, waveFileName);
                }
            }
            return retVal;
        }

        private int freezeReferenceCount(PolyObject pObj, String waveFileName) {
            int retVal = 0;

            List<SoundObject> sObjects = pObj.getSoundObjects(true);

            for (SoundObject sObj : sObjects) {
                if (sObj instanceof PolyObject) {
                    retVal += freezeReferenceCount(pObj,
                            waveFileName);
                } else if (sObj instanceof FrozenSoundObject) {
                    FrozenSoundObject fso = (FrozenSoundObject) sObj;
                    if (fso.getFrozenWaveFileName().equals(waveFileName)) {
                        retVal += 1;
                    }
                }

            }

            return retVal;
        }
    }
}
