/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
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
package blue.ui.core.score.layers.soundObject.views;

import blue.BlueSystem;
import blue.plugin.SoundObjectViewPlugin;
import blue.score.layers.Layer;
import blue.soundObject.AudioFile;
import blue.ui.utilities.audio.AudioWaveformCache;
import blue.ui.utilities.audio.AudioWaveformData;
import blue.ui.utilities.audio.AudioWaveformListener;
import blue.ui.utilities.audio.AudioWaveformUI;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;

/**
 *
 * @author stevenyi
 */
@SoundObjectViewPlugin(scoreObjectType = AudioFile.class)
public class AudioFileView extends SoundObjectView {


    protected int labelOffset = 5;

    private static Font renderFont = new Font("Dialog", Font.BOLD, 12);

    protected static AudioWaveformCache waveCache = AudioWaveformCache.getInstance();
    
    private AudioWaveformData audioWaveformData = null;

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);

        Graphics2D g = (Graphics2D) graphics;
        int w = getWidth();
        int h = getHeight();

        Rectangle clip = graphics.getClipBounds();

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;
        Color waveColor;

        if (isSelected()) {
            bgColor = sObj.getBackgroundColor().brighter().brighter();
            border1 = Color.WHITE;
            border2 = Color.WHITE;
            fontColor = Color.WHITE;
        } else {
            bgColor = sObj.getBackgroundColor();
            border1 = bgColor.brighter().brighter();
            border2 = bgColor.darker().darker();

            fontColor = isBright(bgColor) ? Color.BLACK : Color.WHITE;

        }

        if (isBright(bgColor)) {
            waveColor = bgColor.darker().darker();
        } else {
            waveColor = bgColor.brighter().brighter();
        }

        g.setPaint(bgColor);

        g.fillRect(clip.x, 2, clip.width, h - 4);

        // Draw Waveform
        g.setPaint(waveColor);

        paintWaveform(g, this, timeState.getPixelSecond());

        if (isSelected()) {
            g.setColor(bgColor.darker().darker().darker().darker());
            g.fillRect(0, 2, w, 18);
        }

        // DRAW BORDERS
        g.setColor(border1);
        g.drawLine(0, 2, w, 2);
        g.drawLine(0, 2, 0, h - 2);

        g.setColor(border2);
        g.drawLine(0, h - 2, w, h - 2);
        g.drawLine(w - 1, h - 2, w - 1, 2);

        if (isSelected()) {
            g.setColor(new Color(255, 255, 255, 196));
            g.drawRect(1, 3, w - 3, h - 6);
        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObj.getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 16 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], labelOffset, y);
            }
        }
    }

    private void paintWaveform(Graphics2D g, SoundObjectView sObjView,
            int pixelSeconds) {

        AudioFile audioFile = (AudioFile) sObj;

        String audioFilename = audioFile.getSoundFileName();
        int sObjVisibleHeight = sObjView.getHeight() - 4;

        
        if (this.audioWaveformData == null) {
            this.audioWaveformData = waveCache.getAudioWaveformData(
                    BlueSystem.getFullPath(audioFilename),
                    pixelSeconds);

            if (this.audioWaveformData.percentLoadingComplete < 1.0) {
                waveCache.addAudioWaveformListener(new AudioWaveformListener(
                        audioFilename, sObjView));
            }

        } else if (this.audioWaveformData.pixelSeconds != pixelSeconds
                || !this.audioWaveformData.fileName.equals(audioFile.getSoundFileName())) {
            this.audioWaveformData = waveCache.getAudioWaveformData(
                    BlueSystem.getFullPath(audioFilename),
                    pixelSeconds);
            
            if (this.audioWaveformData.percentLoadingComplete < 1.0) {
                waveCache.addAudioWaveformListener(new AudioWaveformListener(
                        audioFilename, sObjView));
            }
        }

        g.translate(1, 2);

        AudioWaveformUI.paintWaveForm(g, sObjVisibleHeight, this.audioWaveformData, 0);

        g.translate(-1, -2);

    }
    
}
