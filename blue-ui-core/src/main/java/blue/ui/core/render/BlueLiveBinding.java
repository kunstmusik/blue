/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
import blue.CompileData;
import blue.LiveData;
import blue.blueLive.LiveObject;
import blue.blueLive.LiveObjectSet;
import blue.services.render.CsoundBinding;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObject;
import blue.soundObject.TimeBehavior;
import blue.ui.core.blueLive.BlueLiveToolBar;
import blue.utility.ScoreUtilities;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BlueLiveBinding implements CsoundBinding {

    long counter = 0L;
    private final LiveData data;
//    private Csound csound;
    private double sr;
    private long ksmps;

    CompileData compileData = CompileData.createEmptyCompileData();
    private final BlueData blueData;
    
    ExecutorService executor;
    Runnable trigger;

    public BlueLiveBinding(BlueData data) {
        this.blueData = data;
        this.data = data.getLiveData();
        trigger = () -> {
            triggerLiveData();
        };
    }

    @Override
    public void setup(double sr, long ksmps) {
//        this.csound = csound;
        this.sr = sr;
        this.ksmps = ksmps;
        counter = 0;
        this.executor = Executors.newFixedThreadPool(1);
    }

    @Override
    public void updateValueToCsound() {
        if (data.isRepeatEnabled()) {

            long samplesToWait = (long) ((60.0 / data.getTempo()) * data.getRepeat() * sr);

            if ((counter + ksmps) >= samplesToWait) {
                counter -= samplesToWait;
                executor.execute(trigger);
            }
            counter += ksmps;
        } else {
            counter = 0L;
        }

    }

    @Override
    public void updateValueFromCsound() {
    }

    @Override
    public void cleanup() {
        executor.shutdown();
        executor = null;
    }

    protected void triggerLiveData() {
        LiveObjectSet liveObjects = data.getLiveObjectBins().getEnabledLiveObjectSet();

        if (liveObjects.size() > 0) {

            NoteList nl = new NoteList();
            try {

                for (int i = 0, size = liveObjects.size(); i < size; i++) {
                    LiveObject liveObj = liveObjects.get(i);
                    SoundObject sObj = liveObj.getSoundObject();

                    if (sObj.getTimeBehavior() != TimeBehavior.NOT_SUPPORTED) {
                        sObj.setTimeBehavior(TimeBehavior.NONE);
                    }

                    nl.addAll(sObj.generateForCSD(compileData, 0.0f, -1.0f));
                }
            } catch (Exception e) {
                Exceptions.printStackTrace(e);
            }

            ScoreUtilities.scaleScore(nl, 60.0f / data.getTempo());

            String scoreText = nl.toString();

            if (scoreText != null && scoreText.length() > 0) {
                // FIXME - this is certainly not good code but functions for now...
                BlueLiveToolBar.getInstance().sendEvents(scoreText);
            }

        }
    }

}
