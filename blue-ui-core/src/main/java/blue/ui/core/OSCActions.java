/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2011 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core;

import blue.Marker;
import blue.MarkersList;
import blue.midi.MidiInputManager;
import blue.osc.OSCAction;
import blue.osc.OSCManager;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ScoreTopComponent;
import de.sciss.net.OSCMessage;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class OSCActions {

    private OSCActions() {
    }

    public static void installActions(OSCManager manager) {

        /* SCORE ACTIONS */
        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/play") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var data = BlueProjectManager.getInstance().getCurrentBlueData();

                if (data != null) {
                    RealtimeRenderManager.getInstance().renderProject(data);
                }
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/stop") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var manager = RealtimeRenderManager.getInstance();

                if (manager.isRendering()) {
                    manager.stopRendering();
                }
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/rewind") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var data = BlueProjectManager.getInstance().getCurrentBlueData();

                if (data != null) {
                    data.setRenderStartTime(0.0f);
                    data.setRenderEndTime(-1.0f);
                }
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/markerNext") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var data = BlueProjectManager.getInstance().getCurrentBlueData();
                
                if (data != null) {
                    final double currentStartTime = data.getRenderStartTime();
                    MarkersList markers = data.getMarkersList();
                    Marker selected = null;

                    if (markers.size() > 0) {
                        for (int i = 0; i < markers.size(); i++) {
                            Marker a = markers.getMarker(i);

                            if (a.getTime() > currentStartTime) {
                                selected = a;
                                break;
                            }
                        }
                    }

                    final double newStartTime = (selected == null)
                            ? getEndTimeOfScore(data.getScore())
                            : selected.getTime();

                    if (newStartTime > currentStartTime) {
                        data.setRenderStartTime(newStartTime);

                        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                                "ScoreTopComponent");
                        if (scoreTopComponent != null) {
                            scoreTopComponent.scrollToTime(newStartTime);
                        }
                    }
                }
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/markerPrevious") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var data = BlueProjectManager.getInstance().getCurrentBlueData();
                
                if (data != null) {
                    double startTime = data.getRenderStartTime();
                    double newStartTime = 0.0;

                    MarkersList markers = data.getMarkersList();
                    Marker selected = null;

                    for (int i = markers.size() - 1; i >= 0; i--) {
                        Marker a = markers.getMarker(i);

                        if (a.getTime() < startTime) {
                            selected = a;
                            break;
                        }
                    }

                    if (selected != null) {
                        newStartTime = selected.getTime();
                    }

                    data.setRenderStartTime(newStartTime);

                    ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                            "ScoreTopComponent");
                    if (scoreTopComponent != null) {
                        scoreTopComponent.scrollToTime(newStartTime);
                    }
                }
            }
        });

        /* BLUE LIVE ACTIONS */
        OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/onOff") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var data = BlueProjectManager.getInstance().getCurrentBlueData();
                var manager = RealtimeRenderManager.getInstance();

                if (data != null) {
                    if (manager.isBlueLiveRendering()) {
                        manager.stopBlueLiveRendering();
                    } else {
                        manager.renderForBlueLive(data);
                    }
                }
            }

        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/recompile") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var data = BlueProjectManager.getInstance().getCurrentBlueData();

                if (data != null) {
                    RealtimeRenderManager.getInstance().renderForBlueLive(data);
                }
            }

        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/allNotesOff") {

            @Override
            public void actionPerformed(OSCMessage message) {
                RealtimeRenderManager.getInstance().passToStdin("i \"blueAllNotesOff\" 0 1");
            }

        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/toggleMidiInput") {

            @Override
            public void actionPerformed(OSCMessage message) {
                var midiManager = MidiInputManager.getInstance();
                
                // Toggle MIDI input state by checking if it's currently running
                if (midiManager.isRunning()) {
                    midiManager.stop();
                } else {
                    midiManager.start();
                }
            }

        });

    }

    /**
     * Helper method to calculate end time of score
     */
    private static double getEndTimeOfScore(Score score) {
        double max = 0.0;
        for (var layer : score.getAllLayers()) {
            if (layer instanceof ScoreObjectLayer) {
                final var sLayer = (ScoreObjectLayer<ScoreObject>) layer;

                var layerMax = sLayer.stream()
                        .mapToDouble(sObj -> sObj.getStartTime() + sObj.getSubjectiveDuration())
                        .max();

                if (layerMax.isPresent()) {
                    max = Math.max(max, layerMax.getAsDouble());
                }
            }
        }
        return max;
    }
}
