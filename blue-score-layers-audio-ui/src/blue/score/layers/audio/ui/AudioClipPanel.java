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

import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.score.TimeState;
import blue.score.layers.audio.core.AudioClip;
import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.utilities.audio.AudioWaveformCache;
import blue.ui.utilities.audio.AudioWaveformData;
import blue.ui.utilities.audio.AudioWaveformListener;
import blue.ui.utilities.audio.AudioWaveformUI;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Collection;
import javax.swing.BorderFactory;
import javax.swing.JPanel;
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
        ScoreObjectView<AudioClip>, LookupListener {

    protected static final AudioWaveformCache waveformCache
            = AudioWaveformCache.getInstance();

    private final AudioClip audioClip;
    private final TimeState timeState;
    boolean selected = false;
    static Color selectedBg = new Color(255, 255, 255, 128);

    Lookup.Result<AudioClip> result = null;

    AudioWaveformData waveData = null;

    public AudioClipPanel(AudioClip audioClip, TimeState timeState) {
        this.audioClip = audioClip;
        this.timeState = timeState;

        setOpaque(true);
        setBackground(Color.DARK_GRAY);
        setForeground(Color.WHITE);

        reset();
        this.setBorder(BorderFactory.createRaisedSoftBevelBorder());
    }

    @Override
    public void addNotify() {
        super.addNotify();

        audioClip.addScoreObjectListener(this);
        timeState.addPropertyChangeListener(this);

        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");
        result = scoreTopComponent.getLookup().lookupResult(AudioClip.class);

        result.addLookupListener(this);

        updateWaveformData();
    }

    @Override
    public void removeNotify() {
        audioClip.removeScoreObjectListener(this);
        timeState.removePropertyChangeListener(this);
        result.removeLookupListener(this);
        result = null;

        waveformCache.removeReference(waveData);
        this.waveData = null;

        super.removeNotify();
    }

    public void setSelected(boolean selected) {
        if (this.selected == selected) {
            return;
        }
        this.selected = selected;

        if (selected) {
            setBackground(selectedBg);
            setForeground(Color.BLACK);
        } else {
            setBackground(Color.DARK_GRAY);
            setForeground(Color.WHITE);
        }

        repaint();
    }

    public boolean isSelected() {
        return selected;
    }

    private boolean isBright(Color c) {
        return c.getRed() + c.getGreen() + c.getBlue() > (128 * 3);
    }
    
    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g); //To change body of generated methods, choose Tools | Templates.

//        Graphics2D g2d = (Graphics2D) g;
//        Color bg, border, text;
//
//        if (selected) {
//            bg = Color.WHITE;
//            border = Color.DARK_GRAY;
//            text = Color.BLACK;
//        } else {
//            bg = Color.DARK_GRAY;
//            border = Color.BLACK;
//            text = Color.WHITE;
//        }
//
//        Rectangle rect = this.getBounds();
//
//        g2d.setColor(bg);
//        g2d.draw(rect);
//        g2d.setColor(border);
//        g2d.draw(rect);
//

        Color waveColor;

        Color bgColor = getBackground();

        if(isBright(bgColor)) {
            waveColor = bgColor.brighter().brighter();
        } else {
            waveColor = bgColor.darker().darker();
        }

        g.setColor(waveColor);

        g.translate(1, 2);

        AudioWaveformUI.paintWaveForm((Graphics2D) g, this.getHeight(), waveData);

        g.translate(-1, -2);

        g.setColor(getForeground());
        g.drawString(audioClip.getName(), 5, 15);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.timeState) {
            switch (evt.getPropertyName()) {
                case "pixelSecond": {
                    if(timeState.getPixelSecond() != waveData.pixelSeconds) {
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
        waveformCache.removeReference(waveData);
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
}
