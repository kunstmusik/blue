/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue;

import blue.ui.core.render.CsdRenderResult;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import java.net.MalformedURLException;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;

import blue.event.PlayModeListener;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.settings.GeneralSettings;
import blue.settings.PlaybackSettings;
import blue.ui.core.render.APIRunner;
import blue.ui.core.render.CSDRender;
import blue.ui.core.render.CSDRunner;
import blue.ui.core.render.CommandlineRunner;
import blue.ui.core.render.RenderTimeManager;
import blue.ui.core.score.AuditionManager;
import blue.soundObject.SoundObjectException;
import blue.utility.APIUtilities;
import blue.utility.NumberUtilities;
import java.net.URL;
import javax.swing.JToolBar;
import org.openide.awt.HtmlBrowser.URLDisplayer;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Exceptions;
import org.openide.util.ImageUtilities;

/**
 * @author steven
 */
public class MainToolBar extends JToolBar implements PlayModeListener,
        PropertyChangeListener {

    private static final String EMPTY_TIME = "--:--:--:--";

    private static MainToolBar instance = null;

    JButton previousMarkerButton;

    JButton nextMarkerButton;

    JButton rewindButton = new JButton();

    JButton playButton = new JButton();

    JButton stopButton = new JButton();

    JLabel toolStartLabel = new JLabel();

    JLabel toolEndLabel = new JLabel();

    JLabel playTimeLabel = new JLabel();

    JTextField playStartText = new JTextField();

    JTextField playEndText = new JTextField();

    JTextField playTimeText = new JTextField();

    JButton helpButton = new JButton();

    BlueData data;

    APIRunner apiRunner;

    CommandlineRunner commandlineRunner = new CommandlineRunner();

    JCheckBox loopBox = new JCheckBox();

    private boolean isUpdating = false;

    public static MainToolBar getInstance() {
        if (instance == null) {
            instance = new MainToolBar();
        }
        return instance;
    }

    private MainToolBar() {
//        setLayout(new javax.swing.BoxLayout(this, javax.swing.BoxLayout.LINE_AXIS));

        setFloatable(false);

        try {
            apiRunner = new APIRunner();
            apiRunner.addPlayModeListener(this);
        } catch (Throwable t) {
            apiRunner = null;
        }

        previousMarkerButton = new JButton(new PreviousMarkerAction());
        nextMarkerButton = new JButton(new NextMarkerAction());

        previousMarkerButton.setFocusable(false);
        nextMarkerButton.setFocusable(false);

        previousMarkerButton.setText("");
        nextMarkerButton.setText("");

        playStartText.setEditable(false);
        playEndText.setEditable(false);
        playTimeText.setEditable(false);

        playStartText.setFocusable(false);
        playEndText.setFocusable(false);
        playTimeText.setFocusable(false);
        
        rewindButton.setIcon(new ImageIcon(ImageUtilities.loadImage(
                "blue/resources/images/Rewind16.gif")));

        rewindButton.addActionListener(new java.awt.event.ActionListener() {

            public void actionPerformed(ActionEvent e) {
                rewind();
            }
        });

        rewindButton.setFocusable(false);

        playButton.setIcon(new ImageIcon(ImageUtilities.loadImage(
                "blue/resources/images/Play16.gif")));

        playButton.addActionListener(new java.awt.event.ActionListener() {

            public void actionPerformed(ActionEvent e) {
                renderProject();
            }
        });

        playButton.setFocusable(false);

        stopButton.setIcon(new ImageIcon(ImageUtilities.loadImage(
                "blue/resources/images/Stop16.gif")));

        stopButton.addActionListener(new java.awt.event.ActionListener() {

            public void actionPerformed(ActionEvent e) {
                stopRendering();
            }
        });

        stopButton.setFocusable(false);

        toolStartLabel.setText(
                BlueSystem.getString("playBar.startPlayFrom") + " ");
        toolStartLabel.setBorder(new EmptyBorder(0, 5, 0, 0));
        playStartText.setText("0.0");
        playStartText.setPreferredSize(new Dimension(80, 23));

        toolEndLabel.setText(BlueSystem.getString("playBar.playTo") + " ");
        toolEndLabel.setBorder(new EmptyBorder(0, 5, 0, 0));
        playEndText.setText("");
        playEndText.setPreferredSize(new Dimension(80, 23));

        playTimeLabel.setText("Play Time: ");
        playTimeLabel.setBorder(new EmptyBorder(0, 5, 0, 0));
        playTimeText.setText(EMPTY_TIME);
        playTimeText.setPreferredSize(new Dimension(80, 23));

        helpButton.setText(" [ ? ] ");
        helpButton.setPreferredSize(new Dimension(helpButton.getWidth(), 23));
        helpButton.addActionListener(new java.awt.event.ActionListener() {

            public void actionPerformed(ActionEvent e) {
                String url = GeneralSettings.getInstance().getCsoundDocRoot() + "index.html";

                if (!url.startsWith("http") && !url.startsWith("file://")) {
                    url = "file://" + url;
                }

                url = url.replace(" ", "%20");

                System.out.println(BlueSystem.getString(
                        "playBar.helpButton.executingHelp") + " " + url);
                try {
                    URLDisplayer.getDefault().showURL(new URL(url));
                } catch (MalformedURLException ex) {
                    Exceptions.printStackTrace(ex);
                }
            }
        });

        loopBox.setFocusable(false);
        loopBox.setText("Loop");
        loopBox.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                updateLoopRendering(loopBox.isSelected());
            }
        });

        this.add(toolStartLabel, null);
        this.add(playStartText, null);
        this.add(toolEndLabel, null);
        this.add(playEndText, null);
        this.add(playTimeLabel);
        this.add(playTimeText);
        this.add(loopBox, null);
        this.add(previousMarkerButton);
        this.add(nextMarkerButton);
        this.add(rewindButton, null);
        this.add(playButton, null);
        this.add(stopButton, null);
        this.add(helpButton, null);

        commandlineRunner.addPlayModeListener(this);

        // Setup as Listener to RenderTimeManager
        RenderTimeManager manager = RenderTimeManager.getInstance();

        manager.addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                String prop = evt.getPropertyName();

                RenderTimeManager timeManager = RenderTimeManager.getInstance();

                if (evt.getSource() == timeManager) {
                    if (prop.equals(RenderTimeManager.TIME_POINTER)) {
                        float val = ((Float) evt.getNewValue()).floatValue();

                        if (val <= 0.0f) {
                            playTimeText.setText(EMPTY_TIME);
                        } else {
                            float latency = PlaybackSettings.getInstance().
                                    getPlaybackLatencyCorrection();

                            float newVal = val + timeManager.getRenderStartTime() - latency;

                            playTimeText.setText(NumberUtilities.formatTime(
                                    newVal));
                        }

                    }
                }
            }
        });


        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.
                        getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();
    }

    private void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData data = null;
        if (project != null) {
            data = project.getData();
            setData(data);
        }
    }

    /**
     * 
     */
    protected void rewind() {
        if (this.data != null) {
            data.setRenderStartTime(0.0f);
            data.setRenderEndTime(-1.0f);
        }
    }

    /**
     * @param isLoopRendering
     */
    protected void updateLoopRendering(boolean isLoopRendering) {
        if (!isUpdating && this.data != null) {
            data.setLoopRendering(isLoopRendering);
        }

    }

    public void renderProject() {
        if (apiRunner != null && apiRunner.isRunning()) {
            apiRunner.stop();
            return;
        }

        if (commandlineRunner.isRunning()) {
            commandlineRunner.stop();
            return;
        }

        StatusDisplayer.getDefault().setStatusText(BlueSystem.getString("message.generatingCSD"));

        playButton.setEnabled(false);

        CSDRunner csdRunner;

        if (apiRunner != null
                && APIUtilities.isCsoundAPIAvailable()
                && GeneralSettings.getInstance().isUsingCsoundAPI()) {
            csdRunner = apiRunner;
        } else {
            csdRunner = commandlineRunner;
        }

        csdRunner.setData(data);
        try {
            csdRunner.render();
        } catch (SoundObjectException soe) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
                    soe);
        }
    }

    public void generateScoreForTesting() {
        StatusDisplayer.getDefault().setStatusText(BlueSystem.getString("message.generatingCSD"));

        try {
            float startTime = data.getRenderStartTime();
            float endTime = data.getRenderEndTime();

            /*
             * try { tempStart = Float.parseFloat(playStartText.getText()); }
             * catch(NumberFormatException nfe) { tempStart = 0.0f;
             * playStartText.setText(Float.toString(tempStart));
             * JOptionPane.showMessageDialog(null, BlueSystem
             * .getString("message.generateScore.startingFromZero")); }
             */

            CsdRenderResult result = CSDRender.generateCSD(this.data, startTime,
                    endTime,
                    false);

            String csd = result.getCsdText();

            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this), csd,
                    BlueSystem.getString("message.generateScore.csdTest"));
        } catch (SoundObjectException soe) {
            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
                    soe);
            throw new RuntimeException("CSDRender Failed");
        } catch (Exception ex) {
            ex.printStackTrace();
            StatusDisplayer.getDefault().setStatusText("[" + BlueSystem.getString("message.error") + "] " + BlueSystem.
                    getString("message.generateScore.error"));
            System.err.println("[" + BlueSystem.getString("message.error") + "] " + ex.
                    getLocalizedMessage());
        }

    }

    public void stopRendering() {
        AuditionManager.getInstance().stop();

        if (isRendering()) {
            if (apiRunner != null && apiRunner.isRunning()) {
                apiRunner.stop();
            } else {
                commandlineRunner.stop();
            }
        }
        playModeChanged(PLAY_MODE_STOP);
    }

    public boolean isRendering() {
        return ((apiRunner != null && apiRunner.isRunning()) || commandlineRunner.
                isRunning());
    }

    /**
     * @param data2
     */
    public void setData(BlueData data) {
        this.isUpdating = true;

        if (this.data != null) {
            this.data.removePropertyChangeListener(this);
        }

        this.data = data;

        data.addPropertyChangeListener(this);

        this.loopBox.setSelected(data.isLoopRendering());
        playStartText.setText(Float.toString(data.getRenderStartTime()));

        float endTime = data.getRenderEndTime();

        if (endTime < 0.0f) {
            playEndText.setText("");
        } else {
            playEndText.setText(Float.toString(endTime));
        }

        this.isUpdating = false;
    }

    public void playModeChanged(final int playMode) {

        SwingUtilities.invokeLater(new Runnable() {

            public void run() {
                if (playMode == PLAY_MODE_PLAY) {
                    playButton.setEnabled(false);
                    StatusDisplayer.getDefault().setStatusText(BlueSystem.getString("message.renderingCSD"));
                } else if (playMode == PLAY_MODE_STOP) {
                    playButton.setEnabled(true);
                    StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                            "message.finishedRenderingCSD"));
                }
            }
        });

    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.data) {
            String propertyName = evt.getPropertyName();

            if (propertyName.equals("renderStartTime")) {
                playStartText.setText(evt.getNewValue().toString());
            } else if (propertyName.equals("renderLoopTime")) {
                float floatVal = Float.parseFloat(evt.getNewValue().toString());

                if (floatVal < 0.0f) {
                    playEndText.setText("");
                } else {
                    playEndText.setText(evt.getNewValue().toString());
                }
            } else if (propertyName.equals("loopRendering")) {
                isUpdating = true;
                Boolean val = (Boolean) evt.getNewValue();
                loopBox.setSelected(val.booleanValue());
                isUpdating = false;
            }
        }
    }

    class NextMarkerAction extends AbstractAction {

        public NextMarkerAction() {
            super("Go to Next Marker");

            ImageIcon icon = new ImageIcon(
                    ImageUtilities.loadImage(
                    "blue/resources/images/StepForward16.gif"));

            putValue(Action.SHORT_DESCRIPTION, "Go to Next Marker");
            putValue(Action.SMALL_ICON, icon);
        }

        public void actionPerformed(ActionEvent e) {
            float startTime = data.getRenderStartTime();

            MarkersList markers = data.getMarkersList();

            Marker selected = null;

            for (int i = 0; i < markers.size(); i++) {
                Marker a = markers.getMarker(i);

                if (a.getTime() > startTime) {
                    selected = a;
                    break;
                }
            }

            if (selected == null) {
                return;
            }

            float newStartTime = selected.getTime();

            data.setRenderStartTime(newStartTime);

        }
    }

    class PreviousMarkerAction extends AbstractAction {

        public PreviousMarkerAction() {
            super("Go to Previous Marker");

            ImageIcon icon = new ImageIcon(
                    ImageUtilities.loadImage(
                    "blue/resources/images/StepBack16.gif"));

            putValue(Action.SHORT_DESCRIPTION, "Go to Previous Marker");
            putValue(Action.SMALL_ICON, icon);
        }

        public void actionPerformed(ActionEvent e) {
            float startTime = data.getRenderStartTime();
            float newStartTime = 0.0f;

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
        }
    }
}
