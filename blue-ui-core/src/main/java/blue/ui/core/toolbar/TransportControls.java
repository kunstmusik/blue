/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2023 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.toolbar;

import blue.BlueData;
import blue.BlueSystem;
import static blue.event.PlayModeListener.PLAY_MODE_PLAY;
import static blue.event.PlayModeListener.PLAY_MODE_STOP;
import blue.settings.PlaybackSettings;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.object.actions.NavigateToNextMarkerAction;
import blue.ui.core.score.object.actions.NavigateToPreviousMarkerAction;
import blue.ui.utilities.UiUtilities;
import java.awt.Color;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.beans.PropertyChangeListener;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.Icon;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.JToggleButton;
import jiconfont.icons.font_awesome.FontAwesome;
import jiconfont.swing.IconFontSwing;
import org.openide.awt.StatusDisplayer;

/**
 *
 * @author stevenyi
 */
public class TransportControls extends JPanel {

    private static final Color ICON_COLOR = new Color(230, 230, 255);
    private static final int ICON_SIZE = 14;

    private static final Icon repeatActiveIcon = IconFontSwing.buildIcon(FontAwesome.REPEAT, ICON_SIZE, ICON_COLOR);
    private static final Icon repeatNonActiveIcon = IconFontSwing.buildIcon(FontAwesome.REPEAT, ICON_SIZE, Color.LIGHT_GRAY);

    JButton previousMarkerButton;

    JButton nextMarkerButton;

    JButton rewindButton = new JButton();

    JButton playButton = new JButton();

    JButton stopButton = new JButton();

    JToggleButton loopButton = new JToggleButton();

    JToggleButton followPlaybackButton = new JToggleButton("F");

    BlueData data;

    PropertyChangeListener dataListener;

    public TransportControls() {

        this.setBorder(BorderFactory.createEmptyBorder(10,10,5,10));
        
        this.setLayout(new BoxLayout(this, BoxLayout.X_AXIS));

        previousMarkerButton = new JButton(new PreviousMarkerAction());
        nextMarkerButton = new JButton(new NextMarkerAction());

        previousMarkerButton.setFocusable(false);
        nextMarkerButton.setFocusable(false);

        previousMarkerButton.setText("");
        nextMarkerButton.setText("");
        rewindButton.setIcon(IconFontSwing.buildIcon(FontAwesome.FAST_BACKWARD, ICON_SIZE, ICON_COLOR));

        rewindButton.addActionListener((ActionEvent e) -> {
            rewind();
        });

        rewindButton.setFocusable(false);

        playButton.setIcon(IconFontSwing.buildIcon(FontAwesome.PLAY, ICON_SIZE, ICON_COLOR));

        playButton.addActionListener((ActionEvent e) -> {
            renderProject();
        });

        playButton.setFocusable(false);

        stopButton.setIcon(IconFontSwing.buildIcon(FontAwesome.STOP, ICON_SIZE, ICON_COLOR));

        stopButton.addActionListener((ActionEvent e) -> {
            stopRendering();
        });

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

        stopButton.setFocusable(false);

        loopButton.setFocusable(false);
        loopButton.addActionListener((ActionEvent e) -> {
            if (this.data != null) {
                data.setLoopRendering(loopButton.isSelected());
            }
            updateRepeatIcon();
        });

        updateRepeatIcon();

        this.add(previousMarkerButton);
        this.add(Box.createHorizontalStrut(5));
        this.add(nextMarkerButton);
        this.add(Box.createHorizontalStrut(5));
        this.add(rewindButton, null);
        this.add(Box.createHorizontalStrut(5));
        this.add(playButton, null);
        this.add(Box.createHorizontalStrut(5));
        this.add(stopButton, null);
        this.add(Box.createHorizontalStrut(5));
        this.add(followPlaybackButton, null);
        this.add(Box.createHorizontalStrut(5));
        this.add(loopButton, null);
        
        previousMarkerButton.setMargin(new Insets(5,5,5,7));
        nextMarkerButton.setMargin(new Insets(5,7,5,6));
        rewindButton.setMargin(new Insets(5,7,5,6 ));
        playButton.setMargin(new Insets(5,7,5,5));
        stopButton.setMargin(new Insets(5,7,5,6));
        followPlaybackButton.setMargin(new Insets(5,7,5,7));
        loopButton.setMargin(new Insets(5,7,5,7));

        dataListener = (evt) -> {
            switch (evt.getPropertyName()) {
                case "loopRendering":
                    Boolean val = (Boolean) evt.getNewValue();
                    loopButton.setSelected(val.booleanValue());
                    updateRepeatIcon();
                    break;
            }

        };

        RealtimeRenderManager.getInstance().addPlayModeListener((playMode) -> {
            UiUtilities.invokeOnSwingThread(() -> {
                if (playMode == PLAY_MODE_PLAY) {
                    playButton.setEnabled(false);
                    StatusDisplayer.getDefault().setStatusText(BlueSystem.getString("message.renderingCSD"));
                } else if (playMode == PLAY_MODE_STOP) {
                    playButton.setEnabled(true);
                    StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                            "message.finishedRenderingCSD"));
                }
            });

        });

    }

    public void setData(BlueData blueData) {
        if (this.data != null) {
            this.data.removePropertyChangeListener(dataListener);
        }

        this.data = blueData;

        if(this.data != null) {
            data.addPropertyChangeListener(dataListener);
        }

    }

    private void updateRepeatIcon() {
        var icon = (data == null || !data.isLoopRendering())
                ? repeatNonActiveIcon
                : repeatActiveIcon;
        loopButton.setIcon(icon);
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

    public void renderProject() {
        RealtimeRenderManager.getInstance().renderProject(data);
    }

    public void stopRendering() {
        RealtimeRenderManager.getInstance().stopRendering();
    }

    // TODO: This code has been duplicated to NavigateToNextMarkerAction
    // When this toolbar is rewritten, reuse the above action and get rid of
    // this code
    class NextMarkerAction extends AbstractAction {

        NavigateToNextMarkerAction delegate = new NavigateToNextMarkerAction();

        public NextMarkerAction() {
            super("Go to Next Marker");

            var icon = IconFontSwing.buildIcon(FontAwesome.FORWARD, ICON_SIZE, ICON_COLOR);

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

            var icon = IconFontSwing.buildIcon(FontAwesome.BACKWARD, ICON_SIZE, ICON_COLOR);

            putValue(Action.SHORT_DESCRIPTION, "Go to Previous Marker");
            putValue(Action.SMALL_ICON, icon);
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            delegate.actionPerformed(e);
        }
    }
}
