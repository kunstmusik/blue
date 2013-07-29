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
import blue.services.render.RealtimeRenderService;
import blue.settings.GeneralSettings;
import blue.soundObject.SoundObjectException;
import blue.ui.core.render.APIRunner;
import blue.ui.core.render.CommandlineRunner;
import blue.utility.APIUtilities;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JButton;
import javax.swing.JToggleButton;
import javax.swing.JToolBar;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;

/**
 *
 * @author syi
 */
public class BlueLiveToolBar extends JToolBar {

    BlueData data = null;
    APIRunner apiRunner;
    CommandlineRunner commandlineRunner = new CommandlineRunner();
    volatile RealtimeRenderService csdRunner = null;
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

        PlayModeListener playModeListener = new PlayModeListener() {

            public void playModeChanged(int playMode) {
                if (playMode == PlayModeListener.PLAY_MODE_STOP) {
                    
                    System.out.println("Play mode stop");
                    
                    if(restartInProgress) {
                        restartInProgress = false;

                        finishRefresh();
                    } else if (runButton.isSelected()) {
                        runButton.setSelected(false);
                    }
                }

            }
        };

        try {
            apiRunner = new APIRunner();
            apiRunner.addPlayModeListener(playModeListener);
        } catch (Throwable t) {
            apiRunner = null;
        }

        runButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                runButtonActionPerformed();
            }
        });

        refreshButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                refreshButtonActionPerformed();
            }
        });
        
        allNotesOffButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                allNotesOffButtonActionPerformed(e);
            }
        });

        midiButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                midiButtonActionPerformed();
            }
        });

        this.add(runButton);
        this.add(refreshButton);
        this.add(allNotesOffButton);
        this.add(midiButton);

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
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
        if (data == null) {
            return;
        }

        if (csdRunner != null && csdRunner.isRunning()) {
            csdRunner.stop();
            
            csdRunner = null;

            if (runButton.isSelected()) {
                runButton.setSelected(false);
            }

            return;
        }

        if (!runButton.isSelected()) {
            runButton.setSelected(true);
        }

        if (apiRunner != null
                && APIUtilities.isCsoundAPIAvailable()
                && GeneralSettings.getInstance().isUsingCsoundAPI()) {
            csdRunner = apiRunner;
        } else {
            csdRunner = commandlineRunner;
        }

        csdRunner.setData(data);

        new Thread() {

            public void run() {
                try {
                    csdRunner.renderForBlueLive();
                } catch (SoundObjectException soe) {
                    Exceptions.printStackTrace(soe);
                }
            }
        }.run();
    }

    protected void refreshButtonActionPerformed() {
        if (data == null) {
            return;
        }

        if (csdRunner != null && csdRunner.isRunning()) {
            
            restartInProgress = true;
            
            csdRunner.stop();
        
        }
    }
    
    protected void finishRefresh() {
        if (apiRunner != null
                && APIUtilities.isCsoundAPIAvailable()
                && GeneralSettings.getInstance().isUsingCsoundAPI()) {
            csdRunner = apiRunner;
        } else {
            csdRunner = commandlineRunner;
        }

        csdRunner.setData(data);

        new Thread() {

            public void run() {
                try {
                    csdRunner.renderForBlueLive();
                } catch (final SoundObjectException soe) {
                    SwingUtilities.invokeLater(new Runnable() {
                        public void run() {
                            Exceptions.printStackTrace(soe);
                        }
                    });
                    
                }
            }
        }.run();
    }
    
    public void midiButtonActionPerformed() {
        boolean selected = midiButton.isSelected();

        if (selected) {
            MidiInputManager.getInstance().start();
        } else {
            MidiInputManager.getInstance().stop();
        }
    }

    private void allNotesOffButtonActionPerformed(java.awt.event.ActionEvent evt) {
        sendEvents("i \"blueAllNotesOff\" 0 1");
    }

    public void sendEvents(String scoText) {        
        if (csdRunner != null && csdRunner.isRunning()) {
            csdRunner.passToStdin(scoText);
        }
    }

    public boolean isRunning() {
        return csdRunner != null && csdRunner.isRunning();
    }

    public void stopRendering() {
        if (csdRunner != null && csdRunner.isRunning()) {
            csdRunner.stop();

            csdRunner = null;

            if (runButton.isSelected()) {
                runButton.setSelected(false);
            }

            return;
        }
    }
}
