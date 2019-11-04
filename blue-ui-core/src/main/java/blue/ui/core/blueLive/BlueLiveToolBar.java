/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.blueLive;

import blue.BlueData;
import blue.event.PlayModeListener;
import blue.midi.MidiInputManager;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.ui.core.render.RealtimeRenderManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JButton;
import javax.swing.JToggleButton;
import javax.swing.JToolBar;

/**
 *
 * @author syi
 */
public class BlueLiveToolBar extends JToolBar {

    BlueData data = null;
    JToggleButton runButton = new JToggleButton("blueLive");
    JButton refreshButton = new JButton("Recompile");
    JButton allNotesOffButton = new JButton("All Notes Off");
    JToggleButton midiButton = new JToggleButton("MIDI Input");
    private static BlueLiveToolBar instance = null;
    
    boolean restartInProgress = false;

    public static BlueLiveToolBar getInstance() {
        if (instance == null) {
            instance = new BlueLiveToolBar();
        }
        return instance;
    }

    private BlueLiveToolBar() {
        setFloatable(false);

        PlayModeListener playModeListener = (int playMode) -> {
            if (playMode == PlayModeListener.PLAY_MODE_STOP) {
                
                runButton.setSelected(false);
            } else if (playMode == PlayModeListener.PLAY_MODE_PLAY) {
                runButton.setSelected(true);
            }
        };

//FIXME
        RealtimeRenderManager.getInstance().addBlueLivePlayModeListener(playModeListener);
        

        runButton.addActionListener((ActionEvent e) -> {
            runButtonActionPerformed();
        });

        refreshButton.addActionListener((ActionEvent e) -> {
            refreshButtonActionPerformed();
        });
        
        allNotesOffButton.addActionListener(this::allNotesOffButtonActionPerformed);

        midiButton.addActionListener((ActionEvent e) -> {
            midiButtonActionPerformed();
        });

        this.add(runButton);
        this.add(refreshButton);
        this.add(allNotesOffButton);
        this.add(midiButton);

        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                reinitialize();
            }
        });
        
        runButton.setFocusable(false);
        refreshButton.setFocusable(false);
        allNotesOffButton.setFocusable(false);
        midiButton.setFocusable(false);

        reinitialize();
    }

    private void reinitialize() {
        this.data = null;

        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData currentData = null;

        if (project != null) {
            this.data = project.getData();
        }
    }

    protected void runButtonActionPerformed() {
        //        if (data == null) {
        //            return;
        //        }
        //
        //        if (csdRunner != null && csdRunner.isRunning()) {
        //            csdRunner.stop();
        //
        //            csdRunner = null;
        //
        //            if (runButton.isSelected()) {
        //                runButton.setSelected(false);
        //            }
        //
        //            return;
        //        }
        //
        //        if (!runButton.isSelected()) {
        //            runButton.setSelected(true);
        //        }
        //
        //        if (apiRunner != null
        //                && APIUtilities.isCsoundAPIAvailable()
        //                && GeneralSettings.getInstance().isUsingCsoundAPI()) {
        //            csdRunner = apiRunner;
        //        } else {
        //            csdRunner = commandlineRunner;
        //        }
        //
        //        csdRunner.setData(data);
        //
        //        new Thread() {
        //
        //            public void run() {
        //                try {
        //                    csdRunner.renderForBlueLive();
        //                } catch (SoundObjectException soe) {
        //                    Exceptions.printStackTrace(soe);
        //                }
        //            }
        //        }.run();
        RealtimeRenderManager manager = RealtimeRenderManager.getInstance();

        if(manager.isBlueLiveRendering()) {
            manager.stopBlueLiveRendering();
        } else {
            manager.renderForBlueLive(data);
        }
    }

    protected void refreshButtonActionPerformed() {
        if (data == null) {
            return;
        }

//        if (csdRunner != null && csdRunner.isRunning()) {
//            
//            restartInProgress = true;
//            
//            csdRunner.stop();
//        
//        }
        
        RealtimeRenderManager.getInstance().renderForBlueLive(data);
    }
    
    protected void finishRefresh() {
//        if (apiRunner != null
//                && APIUtilities.isCsoundAPIAvailable()
//                && GeneralSettings.getInstance().isUsingCsoundAPI()) {
//            csdRunner = apiRunner;
//        } else {
//            csdRunner = commandlineRunner;
//        }
//
//        csdRunner.setData(data);
//
//        new Thread() {
//
//            public void run() {
//                try {
//                    csdRunner.renderForBlueLive();
//                } catch (final SoundObjectException soe) {
//                    SwingUtilities.invokeLater(new Runnable() {
//                        public void run() {
//                            Exceptions.printStackTrace(soe);
//                        }
//                    });
//                    
//                }
//            }
//        }.run();
    }
    
    public void midiButtonActionPerformed() {
        boolean selected = midiButton.isSelected();

        if (selected) {
            MidiInputManager.getInstance().start();
        } else {
            MidiInputManager.getInstance().stop();
        }
    }

    protected void allNotesOffButtonActionPerformed(java.awt.event.ActionEvent evt) {
        sendEvents("i \"blueAllNotesOff\" 0 1");
    }

    public void sendEvents(String scoText) {        
        RealtimeRenderManager.getInstance().passToStdin(scoText);
    }

    public boolean isRunning() {
        return RealtimeRenderManager.getInstance().isBlueLiveRendering();
    }

    public void stopRendering() {
        RealtimeRenderManager manager = RealtimeRenderManager.getInstance();
        if (manager.isBlueLiveRendering()) {
            manager.stopBlueLiveRendering();

            if (runButton.isSelected()) {
                runButton.setSelected(false);
            }
        }
    }
}
