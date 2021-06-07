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
import blue.soundObject.FrozenSoundObject;
import blue.ui.utilities.audio.AudioWaveformCache;
import blue.ui.utilities.audio.AudioWaveformData;
import blue.ui.utilities.audio.AudioWaveformListener;
import blue.ui.utilities.audio.AudioWaveformUI;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import javax.swing.UIManager;

/**
 *
 * @author stevenyi
 */
@SoundObjectViewPlugin(scoreObjectType = FrozenSoundObject.class)
public class FrozenSoundObjectView extends SoundObjectView {

    protected static AudioWaveformCache waveCache = AudioWaveformCache.getInstance();

    private AudioWaveformData audioWaveformData = null;

    private static final Font renderFont = 
            UIManager.getFont("Label.font").deriveFont(Font.BOLD, 12);

    protected static Color selectedBgColor = Color.white;

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.darkGray;

    protected static Color normalBgColor = new Color(193, 205, 205);

    private static final Color normalBorder1 = normalBgColor.brighter().brighter();

    private static final Color normalBorder2 = normalBgColor.darker().darker();

    protected static Color normalFontColor = Color.black;

    private static final Color shadeColor = new Color(0, 0, 0, 64);

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);

        Graphics2D g = (Graphics2D) graphics;
        int w = getWidth();
        int h = getHeight();

        FrozenSoundObject fso = (FrozenSoundObject) sObj;
        double percentOriginal = fso.getFrozenSoundObject()
                .getSubjectiveDuration()
                / fso.getSubjectiveDuration();

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;
        Color waveColor;

        if (isSelected()) {
            bgColor = normalBgColor.brighter().brighter();
            border1 = Color.WHITE;
            border2 = Color.WHITE;
            fontColor = Color.WHITE;
        } else {
            bgColor = normalBgColor;
            border1 = normalBorder1;
            border2 = normalBorder2;
            fontColor = normalFontColor;
        }

        if (isBright(bgColor)) {
            waveColor = bgColor.darker().darker();
        } else {
            waveColor = bgColor.brighter().brighter();
        }

        g.setPaint(bgColor);

        // fill original soundObject area
        g.fillRect(0, 1, w, h - 2);

        // fill extended area
        g.setColor(shadeColor);
        g.fillRect((int) (w * percentOriginal), 1, w, h - 2);
        
        // Draw Waveform
        g.setPaint(waveColor);

        paintWaveform(g, this, timeState.getPixelSecond());
        
        if (isSelected()) {
            g.setColor(bgColor.darker().darker().darker().darker());
            g.fillRect(0, 2, w, 18);
        }
        
        g.setColor(border1);
        g.drawRect(0, 1, w - 1, h-2);
        
//        g.drawLine(0, 2, w, 2);
//        g.drawLine(0, 2, 0, h - 2);
//
//        g.setColor(border2);
//        g.drawLine(0, h - 2, w, h - 2);
//        g.drawLine(w - 1, h - 2, w - 1, 2);
//
//        if (isSelected()) {
//            g.setColor(new Color(255, 255, 255, 196));
//            g.drawRect(1, 3, w - 3, h - 6);
//        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObj.getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 16 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], 5, y);
            }
        }
    }

    private void paintWaveform(Graphics2D g, SoundObjectView sObjView,
            int pixelSeconds) {

        FrozenSoundObject fso = (FrozenSoundObject) sObj;

        final String audioFilename = fso.getFrozenWaveFileName();
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
                || !this.audioWaveformData.fileName.equals(audioFilename)) {
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
