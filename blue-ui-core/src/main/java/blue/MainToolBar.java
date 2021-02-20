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

import blue.event.PlayModeListener;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.object.actions.NavigateToNextMarkerAction;
import blue.ui.core.score.object.actions.NavigateToPreviousMarkerAction;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.Box;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JTextField;
import javax.swing.JToggleButton;
import javax.swing.JToolBar;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import jiconfont.icons.font_awesome.FontAwesome;
import jiconfont.swing.IconFontSwing;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Lookup;

/**
 * @author steven
 */
public class MainToolBar extends JToolBar implements PlayModeListener,
        PropertyChangeListener, RenderTimeManagerListener {

    private static final String EMPTY_TIME = "--:--:--:--";

    private static final Color ICON_COLOR = new Color(230, 230, 255);

    private static MainToolBar instance = null;

    JButton previousMarkerButton;

    JButton nextMarkerButton;

    JToggleButton followPlaybackButton = new JToggleButton("F");
    
    JButton widgetInfoButton = new JButton();

    JButton rewindButton = new JButton();

    JButton playButton = new JButton();

    JButton stopButton = new JButton();

    JLabel toolStartLabel = new JLabel();

    JLabel toolEndLabel = new JLabel();

    JLabel playTimeLabel = new JLabel();

    JTextField playStartText = new JTextField();

    JTextField playEndText = new JTextField();

    JTextField playTimeText = new JTextField();

    BlueData data;

    JCheckBox loopBox = new JCheckBox();

    private boolean isUpdating = false;

    RenderTimeManager renderTimeManager
            = Lookup.getDefault().lookup(RenderTimeManager.class);

    public static MainToolBar getInstance() {
        if (instance == null) {
            instance = new MainToolBar();
        }
        return instance;
    }

    private MainToolBar() {
//        setLayout(new javax.swing.BoxLayout(this, javax.swing.BoxLayout.LINE_AXIS));

        setFloatable(false);

        RealtimeRenderManager.getInstance().addPlayModeListener(this);

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

//        rewindButton.setIcon(new ImageIcon(ImageUtilities.loadImage(
//                "blue/resources/images/Rewind16.gif")));
        rewindButton.setIcon(IconFontSwing.buildIcon(FontAwesome.FAST_BACKWARD, 14, ICON_COLOR));

        rewindButton.addActionListener((ActionEvent e) -> {
            rewind();
        });

        rewindButton.setFocusable(false);

        playButton.setIcon(IconFontSwing.buildIcon(FontAwesome.PLAY, 14, ICON_COLOR));

        playButton.addActionListener((ActionEvent e) -> {
            renderProject();
        });

        playButton.setFocusable(false);

        stopButton.setIcon(IconFontSwing.buildIcon(FontAwesome.STOP, 14, ICON_COLOR));

        stopButton.addActionListener((ActionEvent e) -> {
            stopRendering();
        });

        final var widgetInfoShowingIcon = IconFontSwing.buildIcon(FontAwesome.INFO_CIRCLE, 14, ICON_COLOR);
        final var widgetInfoNotShowingIcon = IconFontSwing.buildIcon(FontAwesome.INFO_CIRCLE, 14, Color.LIGHT_GRAY);
        final var prefs = BSBPreferences.getInstance();

        Runnable updateWidgetIcon = () -> {
            var icon = prefs.getShowWidgetComments() ? widgetInfoShowingIcon : widgetInfoNotShowingIcon;
            widgetInfoButton.setIcon(icon);
        };

        widgetInfoButton.addActionListener(ae -> {
            UiUtilities.invokeOnSwingThread(() -> {
                prefs.setShowWidgetComments(!prefs.getShowWidgetComments());
            });
        });
        widgetInfoButton.setFocusable(false);
        widgetInfoButton.setToolTipText("Toggle showing BSB Widget information as tooltips in usage mode");

        var playbackSettings = PlaybackSettings.getInstance();
                
        followPlaybackButton.setSelected(playbackSettings.isFollowPlayback());
        followPlaybackButton.setToolTipText("Set whether Score scrolls to follow current playback time");
        followPlaybackButton.addActionListener(evt -> {
            playbackSettings.setFollowPlayback(followPlaybackButton.isSelected());
            playbackSettings.save();
        });
        
        PlaybackSettings.getPreferences().addPreferenceChangeListener(evt -> {
            followPlaybackButton.setSelected(playbackSettings.isFollowPlayback());
        });
        
        
        prefs.showWidgetCommentsProperty().addListener((obs, old, newVal) -> {
            updateWidgetIcon.run();
        });

        updateWidgetIcon.run();

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

        loopBox.setFocusable(false);
        loopBox.setText("Loop");
        loopBox.addActionListener((ActionEvent e) -> {
            updateLoopRendering(loopBox.isSelected());
        });

        this.add(toolStartLabel, null);
        this.add(playStartText, null);
        this.add(toolEndLabel, null);
        this.add(playEndText, null);
        this.add(playTimeLabel);
        this.add(playTimeText);
        this.add(Box.createHorizontalStrut(5));
        this.add(followPlaybackButton, null);
        this.add(Box.createHorizontalStrut(5));        
        this.add(widgetInfoButton, null);
        this.add(loopBox, null);
        this.add(previousMarkerButton);
        this.add(nextMarkerButton);
        this.add(rewindButton, null);
        this.add(playButton, null);
        this.add(stopButton, null);

        // Setup as Listener to RenderTimeManager
        renderTimeManager.addPropertyChangeListener((PropertyChangeEvent evt) -> {
            String prop = evt.getPropertyName();

            if (evt.getSource() == renderTimeManager) {
                if (prop.equals(RenderTimeManager.TIME_POINTER)) {
                    double val = ((Double) evt.getNewValue()).doubleValue();

                    if (val <= 0.0f) {
                        playTimeText.setText(EMPTY_TIME);
                    } else {
                        double latency = PlaybackSettings.getInstance().
                                getPlaybackLatencyCorrection();

                        double newVal = val + renderTimeManager.getRenderStartTime() - latency;

                        playTimeText.setText(NumberUtilities.formatTime(
                                newVal));
                    }

                }
            }
        });
        renderTimeManager.addRenderTimeManagerListener(this);

        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(evt.
                    getPropertyName())) {
                reinitialize();
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
    public void rewind() {
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
//        if(AuditionManager.getInstance().isRunning()) {
//            AuditionManager.getInstance().stop();
//        }
//        
//        if (apiRunner != null && apiRunner.isRunning()) {
//            apiRunner.stop();
//            return;
//        }
//
//        if (commandlineRunner.isRunning()) {
//            commandlineRunner.stop();
//            return;
//        }
//
//        StatusDisplayer.getDefault().setStatusText(BlueSystem.getString("message.generatingCSD"));
//
//        playButton.setEnabled(false);
//
//        RealtimeRenderService csdRunner;
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
//        try {
//            csdRunner.render();
//        } catch (SoundObjectException soe) {
//            ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
//                    soe);
//        }
        RealtimeRenderManager.getInstance().renderProject(data);
    }

    public void stopRendering() {
//        AuditionManager.getInstance().stop();
//
//        if (isRendering()) {
//            if (apiRunner != null && apiRunner.isRunning()) {
//                apiRunner.stop();
//            } else {
//                commandlineRunner.stop();
//            }
//        }
//        playModeChanged(PLAY_MODE_STOP);
        RealtimeRenderManager.getInstance().stopRendering();
    }

    //FIXME - remove this and change callers to use RealtimeRenderManager
    public boolean isRendering() {
        return RealtimeRenderManager.getInstance().isRendering();
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
        playStartText.setText(Double.toString(data.getRenderStartTime()));

        double endTime = data.getRenderEndTime();

        if (endTime < 0.0f) {
            playEndText.setText("");
        } else {
            playEndText.setText(Double.toString(endTime));
        }

        this.isUpdating = false;
    }

    @Override
    public void playModeChanged(final int playMode) {

        SwingUtilities.invokeLater(() -> {
            if (playMode == PLAY_MODE_PLAY) {
                playButton.setEnabled(false);
                StatusDisplayer.getDefault().setStatusText(BlueSystem.getString("message.renderingCSD"));
            } else if (playMode == PLAY_MODE_STOP) {
                playButton.setEnabled(true);
                StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                        "message.finishedRenderingCSD"));
            }
        });

    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.data) {
            String propertyName = evt.getPropertyName();
            switch (propertyName) {
                case "renderStartTime":
                    playStartText.setText(evt.getNewValue().toString());
                    break;
                case "renderLoopTime":
                    double doubleVal = Double.parseDouble(evt.getNewValue().toString());
                    if (doubleVal < 0.0f) {
                        playEndText.setText("");
                    } else {
                        playEndText.setText(evt.getNewValue().toString());
                    }
                    break;
                case "loopRendering":
                    isUpdating = true;
                    Boolean val = (Boolean) evt.getNewValue();
                    loopBox.setSelected(val.booleanValue());
                    isUpdating = false;
                    break;
            }
        }
    }

    @Override
    public void renderInitiated() {
    }

    @Override
    public void renderEnded() {
    }

    @Override
    public void renderTimeUpdated(double timePointer) {
        double val = timePointer;

        if (val <= 0.0f) {
            playTimeText.setText(EMPTY_TIME);
        } else {
            double latency = PlaybackSettings.getInstance().
                    getPlaybackLatencyCorrection();

            double newVal = val + renderTimeManager.getRenderStartTime() - latency;

            playTimeText.setText(NumberUtilities.formatTime(
                    newVal));
        }
    }

    // TODO: This code has been duplicated to NavigateToNextMarkerAction
    // When this toolbar is rewritten, reuse the above action and get rid of
    // this code
    class NextMarkerAction extends AbstractAction {

        NavigateToNextMarkerAction delegate = new NavigateToNextMarkerAction();

        public NextMarkerAction() {
            super("Go to Next Marker");

            var icon = IconFontSwing.buildIcon(FontAwesome.FORWARD, 14, ICON_COLOR);

            putValue(Action.SHORT_DESCRIPTION, "Go to Next Marker");
            putValue(Action.SMALL_ICON, icon);
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            delegate.actionPerformed(e);
        }
    }

    // TODO: This code has been duplicate to NavigateToPreviousMarkerAction
    // When this toolbar is rewritten, reuse the above action and get rid of
    // this code
    class PreviousMarkerAction extends AbstractAction {

        NavigateToPreviousMarkerAction delegate = new NavigateToPreviousMarkerAction();

        public PreviousMarkerAction() {
            super("Go to Previous Marker");

            var icon = IconFontSwing.buildIcon(FontAwesome.BACKWARD, 14, ICON_COLOR);

            putValue(Action.SHORT_DESCRIPTION, "Go to Previous Marker");
            putValue(Action.SMALL_ICON, icon);
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            delegate.actionPerformed(e);
        }
    }
}
