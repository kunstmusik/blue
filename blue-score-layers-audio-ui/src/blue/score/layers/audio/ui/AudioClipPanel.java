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
package blue.score.layers.audio.ui;

import blue.ui.utilities.RedispatchMouseAdapter;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.score.TimeState;
import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.FadeType;
import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.utilities.BlueGradientFactory;
import blue.ui.utilities.audio.AudioWaveformCache;
import blue.ui.utilities.audio.AudioWaveformData;
import blue.ui.utilities.audio.AudioWaveformListener;
import blue.ui.utilities.audio.AudioWaveformUI;
import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Collection;
import java.util.function.BiConsumer;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import org.openide.util.Lookup;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class AudioClipPanel extends JPanel
        implements PropertyChangeListener, ScoreObjectListener,
        ScoreObjectView<AudioClip>, LookupListener,
        ChangeListener<Number> {

    protected static final AudioWaveformCache waveformCache
            = AudioWaveformCache.getInstance();

    private final AudioClip audioClip;
    private final TimeState timeState;
    boolean selected = false;
    boolean showFadeHandles = false;

    protected static Color selectedBgColor = new Color(255, 255, 255, 128);

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.black;

    protected static Color fadeLightColor = new Color(255, 255, 255, 64);
    protected static Color fadeDarkColor = new Color(0, 0, 0, 64);

    Lookup.Result<AudioClip> result = null;

    AudioWaveformData waveData = null;

    private final FadeHandle leftFadeHandle;
    private final FadeHandle rightFadeHandle;

    private final BiConsumer<AudioClip, Float> splitHandler;

    ChangeListener<Number> fadeListener = (obs, o, n) -> {
        updateFadeHandleLocations();
        repaint();
    };

    ChangeListener<FadeType> fadeTypeListener = (obs, o, n) -> {
        repaint();
    };

    MouseAdapter releaseOutsideAdapter = new MouseAdapter() {
        @Override
        public void mouseReleased(MouseEvent e) {
            Point p = SwingUtilities.convertPoint((Component) e.getSource(),
                    e.getPoint(), AudioClipPanel.this);
            if (!AudioClipPanel.this.contains(p)) {
                leftFadeHandle.setVisible(false);
                rightFadeHandle.setVisible(false);
            }
        }

    };

    MouseAdapter mouseAdapter = new RedispatchMouseAdapter() {
        boolean active = false;
        int startX = 0;
        private float initialStartTime = 0.0f;

        @Override
        public void mouseEntered(MouseEvent e) {
            Color bgColor;
            if (selected) {
                bgColor = selectedFontColor;
            } else {
                bgColor = audioClip.getBackgroundColor();

                bgColor = isBright(bgColor) ? Color.BLACK : Color.WHITE;
            }

            leftFadeHandle.setBackground(bgColor);
            rightFadeHandle.setBackground(bgColor);
            leftFadeHandle.setVisible(true);
            rightFadeHandle.setVisible(true);

        }

        @Override
        public void mouseExited(MouseEvent e) {

            if (!leftFadeHandle.isAdjustingFade()
                    && !leftFadeHandle.contains(
                            SwingUtilities.convertPoint(AudioClipPanel.this,
                                    e.getPoint(), leftFadeHandle)
                    )
                    && !rightFadeHandle.isAdjustingFade()
                    && !rightFadeHandle.contains(
                            SwingUtilities.convertPoint(AudioClipPanel.this,
                                    e.getPoint(), rightFadeHandle))) {
                leftFadeHandle.setVisible(false);
                rightFadeHandle.setVisible(false);

                Component pane = SwingUtilities.getRootPane(AudioClipPanel.this)
                        .getGlassPane();

                pane.setCursor(null);
                pane.setVisible(false);

            }
        }

        @Override
        public void mouseMoved(MouseEvent e) {
            Component pane = SwingUtilities.getRootPane(AudioClipPanel.this).getGlassPane();

            if (e.isAltDown() && e.isShiftDown()) {
                pane.setCursor(Cursor.getPredefinedCursor(Cursor.CROSSHAIR_CURSOR));
                pane.setVisible(true);
            } else {
                pane.setCursor(null);
                pane.setVisible(false);
            }
            this.redispatchEvent(e);
        }

        @Override
        public void mouseDragged(MouseEvent e
        ) {
            if (active) {
                int xDiff = e.getX() - startX;

                if (xDiff == 0) {
                    audioClip.setFileStartTime(initialStartTime);
                } else {
                    float newTime = initialStartTime
                            - ((float) xDiff / timeState.getPixelSecond());
                    newTime = Math.max(0.0f, newTime);
                    newTime = Math.min(audioClip.getAudioDuration() - audioClip.getDuration(), newTime);
                    audioClip.setFileStartTime(newTime);
                }

                e.consume();
            } else {
                redispatchEvent(e);
            }
        }

        @Override

        public void mouseReleased(MouseEvent e
        ) {
            if (active) {
                e.consume();
                active = false;
                startX = -1;
                initialStartTime = -1.0f;
            } else {
                redispatchEvent(e);
            }
        }

        @Override
        public void mousePressed(MouseEvent e
        ) {
            if (SwingUtilities.isRightMouseButton(e)) {
                int x = e.getX();
                if (x < leftFadeHandle.getX()) {
                    FadeTypePopup popup = FadeTypePopup.getInstance();
                    popup.setup(audioClip, true);
                    popup.show(AudioClipPanel.this, x, e.getY());
                } else if (x > rightFadeHandle.getX() - rightFadeHandle.getWidth()) {
                    FadeTypePopup popup = FadeTypePopup.getInstance();
                    popup.setup(audioClip, false);
                    popup.show(AudioClipPanel.this, x, e.getY());
                } else {
                    redispatchEvent(e);
                    active = false;
                }
            } else if (e.isAltDown()) {
                if (e.isShiftDown()) {
                    float time = e.getX() / (float) timeState.getPixelSecond();
                    splitHandler.accept(audioClip, time);
                } else {
                    active = true;
                    startX = e.getX();
                    initialStartTime = audioClip.getFileStartTime();
                }
                e.consume();
            } else {
                redispatchEvent(e);
                active = false;
            }
        }

    };

    public AudioClipPanel(AudioClip audioClip, TimeState timeState,
            BiConsumer<AudioClip, Float> splitHandler) {
        this.audioClip = audioClip;
        this.timeState = timeState;
        this.splitHandler = splitHandler;

        setOpaque(false);
        setBackground(Color.DARK_GRAY);
        setForeground(Color.WHITE);
        setLayout(null);

        leftFadeHandle = new FadeHandle(audioClip, timeState, true);
        leftFadeHandle.setSize(5, 5);
        leftFadeHandle.setVisible(false);
        rightFadeHandle = new FadeHandle(audioClip, timeState, false);
        rightFadeHandle.setSize(5, 5);
        rightFadeHandle.setVisible(false);
        this.add(leftFadeHandle);
        this.add(rightFadeHandle);

        reset();
        updateFadeHandleLocations();

//        this.setBorder(BorderFactory.createRaisedSoftBevelBorder());
    }

    protected void updateFadeHandleLocations() {
        int leftHandleX
                = (int) (audioClip.getFadeIn() * timeState.getPixelSecond());
        int rightHandleX
                = (int) (audioClip.getFadeOut() * timeState.getPixelSecond());

        rightHandleX = getWidth() - rightHandleX - 5;

        leftFadeHandle.setLocation(leftHandleX, 2);
        leftFadeHandle.addMouseListener(releaseOutsideAdapter);
        rightFadeHandle.setLocation(rightHandleX, 2);
        rightFadeHandle.addMouseListener(releaseOutsideAdapter);
    }

    @Override
    public void addNotify() {
        super.addNotify();

        audioClip.addScoreObjectListener(this);
        audioClip.fileStartTimeProperty().addListener(this);
        audioClip.fadeInProperty().addListener(fadeListener);
        audioClip.fadeInTypeProperty().addListener(fadeTypeListener);
        audioClip.fadeOutProperty().addListener(fadeListener);
        audioClip.fadeOutTypeProperty().addListener(fadeTypeListener);
        timeState.addPropertyChangeListener(this);

        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");
        result
                = scoreTopComponent.getLookup().lookupResult(AudioClip.class
                );

        result.addLookupListener(this);

        Collection<? extends AudioClip> soundObjects = result.allInstances();
        setSelected(soundObjects.contains(this.audioClip));
        updateWaveformData();

        this.addMouseListener(mouseAdapter);
        this.addMouseMotionListener(mouseAdapter);
    }

    @Override
    public void removeNotify() {
        audioClip.removeScoreObjectListener(this);
        audioClip.fileStartTimeProperty().removeListener(this);
        audioClip.fadeInProperty().removeListener(fadeListener);
        audioClip.fadeInTypeProperty().removeListener(fadeTypeListener);
        audioClip.fadeOutProperty().removeListener(fadeListener);
        audioClip.fadeOutTypeProperty().removeListener(fadeTypeListener);

        timeState.removePropertyChangeListener(this);
        result.removeLookupListener(this);
        result = null;

        this.waveData = null;

        this.removeMouseListener(mouseAdapter);
        this.removeMouseMotionListener(mouseAdapter);

        super.removeNotify();
    }

    public void setSelected(boolean selected) {
        if (this.selected == selected) {
            return;
        }
        this.selected = selected;

        repaint();
    }

    public boolean isSelected() {
        return selected;
    }

    private boolean isBright(Color c) {
        return c.getRed() + c.getGreen() + c.getBlue() > (128 * 3);
    }

    private void paintFade(Graphics g, int xOffset, FadeType fadeType, float fadeTime, boolean fadeIn) {

        int len = (int) (fadeTime * timeState.getPixelSecond());
        double dlen = (double) len;

        if (len < 2) {
            return;
        }

        int[] polyX = new int[len + 3];
        int[] polyY = new int[len + 3];
        int h = getHeight() - 4;

        if(fadeIn) {
            polyX[len] = xOffset + len;
            polyY[len] = 0;
            polyX[len + 1] = xOffset;
            polyY[len + 1] = 0;
            polyX[len + 2] = xOffset;
            polyY[len + 2] = h;
        } else {
            polyX[len] = xOffset + len;
            polyY[len] = h;
            polyX[len + 1] = xOffset + len;
            polyY[len + 1] = 0;
            polyX[len + 2] = xOffset;
            polyY[len + 2] = 0;
        }

        for (int i = 0; i < len; i++) {
            double x = i / dlen;
            double fadeY = FadeRenderer.getValue(x, fadeType, fadeIn);
            polyX[i] = i + xOffset;
            polyY[i] = (int) ((1.0 - fadeY) * h);
        }

        g.fillPolygon(polyX, polyY, len + 3);
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        Graphics2D g = (Graphics2D) graphics;
        int w = getWidth();
        int h = getHeight();

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;
        Color waveColor;
        Color fadeColor;

        if (isSelected()) {
            bgColor = selectedBgColor;
            border1 = selectedBorder1;
            border2 = selectedBorder2;
            fontColor = selectedFontColor;
            fadeColor = fadeDarkColor;
            waveColor = bgColor.brighter().brighter();
        } else {
            Color bg = audioClip.getBackgroundColor();
            bgColor = new Color(bg.getRed(), bg.getGreen(),
                    bg.getBlue(), 194);
            border1 = bgColor.brighter().brighter();
            border2 = bgColor.darker().darker();

            fontColor = isBright(bgColor) ? Color.BLACK : Color.WHITE;
            fadeColor = isBright(bgColor) ? fadeDarkColor : fadeLightColor;
            waveColor = bg;

            if (isBright(bg)) {
                waveColor = waveColor.darker().darker();
            } else {
                waveColor = waveColor.brighter().brighter();
            }
        }

        g.setPaint(BlueGradientFactory.getGradientPaint(bgColor));

        g.fillRect(0, 2, w, h - 4);

        // DRAW WAVEFORM
        g.setColor(waveColor);

        g.translate(1, 2);

        int audioFileStart = (int) (audioClip.getFileStartTime() * timeState.getPixelSecond());
        AudioWaveformUI.paintWaveForm(g, this.getHeight() - 4, waveData,
                audioFileStart);

        // paint fades
        if (audioClip.getFadeIn() > 0.0f) {
            g.setColor(fadeColor);
            paintFade(graphics, 0, audioClip.getFadeInType(), 
                    audioClip.getFadeIn(), true);
//            g.fillPolygon(new int[]{0, 0, leftFadeHandle.getX()},
//                    new int[]{this.getHeight() - 4, 0, 0},
//                    3);
        }

        if (audioClip.getFadeOut() > 0.0f) {
            g.setColor(fadeColor);
            paintFade(graphics, rightFadeHandle.getX() + 5, 
                    audioClip.getFadeOutType(), audioClip.getFadeOut(), false);
//            g.fillPolygon(new int[]{rightFadeHandle.getX() + 5,
//                getWidth() - 2, getWidth() - 2},
//                    new int[]{0, 0, this.getHeight() - 4},
//                    3);
        }

        g.translate(-1, -2);

        g.setColor(fontColor);
        g.drawString(audioClip.getName(), 5, 15);

        // DRAW BORDERS
        g.setColor(border1);
        g.drawLine(0, 2, w - 1, 2);
        g.drawLine(0, 2, 0, h - 4);

        g.setColor(border2);
        g.drawLine(0, h - 3, w, h - 3);
        g.drawLine(w - 1, h - 3, w - 1, 2);

    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.timeState) {
            switch (evt.getPropertyName()) {
                case "pixelSecond": {
                    if (timeState.getPixelSecond() != waveData.pixelSeconds) {
                        updateWaveformData();
                    }
                    reset();
                    break;
                }
            }
        }
    }

    private void updateWaveformData() {
        String absFilePath = audioClip.getAudioFile().getAbsolutePath();
        waveData = waveformCache.getAudioWaveformData(
                absFilePath,
                timeState.getPixelSecond());

        if (waveData.percentLoadingComplete < 1.0) {
            waveformCache.addAudioWaveformListener(
                    new AudioWaveformListener(absFilePath, this));
        }
    }

    protected void reset() {
        int pixelSecond = timeState.getPixelSecond();
        double x = audioClip.getStartTime() * pixelSecond;
        double width = audioClip.getSubjectiveDuration() * pixelSecond;
        setBounds((int) x, getY(), (int) width, getHeight());
        updateFadeHandleLocations();
    }

    @Override
    public AudioClip getScoreObject() {
        return audioClip;
    }

    @Override
    public void resultChanged(LookupEvent ev) {
        Collection<? extends AudioClip> soundObjects = result.allInstances();
        boolean newSelected = soundObjects.contains(this.audioClip);

        setSelected(newSelected);
    }

    @Override
    public void scoreObjectChanged(ScoreObjectEvent event) {
        if (event.getScoreObject() == this.audioClip) {
            switch (event.getPropertyChanged()) {
                case ScoreObjectEvent.START_TIME:
                case ScoreObjectEvent.DURATION:
                    reset();
                    break;
            }
        }
    }

    @Override
    public void changed(ObservableValue<? extends Number> observable, Number oldValue, Number newValue) {
        repaint();
    }
}
