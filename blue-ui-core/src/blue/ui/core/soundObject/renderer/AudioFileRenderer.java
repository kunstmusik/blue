package blue.ui.core.soundObject.renderer;

import blue.score.layers.Layer;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;

import blue.ui.core.score.layers.soundObject.SoundObjectView;
import blue.soundObject.AudioFile;
import blue.soundObject.SoundObject;
import blue.ui.core.soundObject.renderer.audioFile.AudioWaveformCache;
import blue.ui.core.soundObject.renderer.audioFile.AudioWaveformData;
import blue.ui.core.soundObject.renderer.audioFile.AudioWaveformListener;

public class AudioFileRenderer implements BarRenderer {

    private static final String AUDIO_WAVEFORM_DATA = "audioWaveformData";

    protected int labelOffset = 5;

    private static Font renderFont = new Font("Dialog", Font.BOLD, 12);

    protected static Color selectedBgColor = Color.white;

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.darkGray;

    protected static AudioWaveformCache waveCache = new AudioWaveformCache();

    public void render(Graphics graphics, SoundObjectView sObjView,
            int pixelSeconds) {

        Rectangle clip = graphics.getClipBounds();

        Graphics2D g = (Graphics2D) graphics;
        int w = sObjView.getSize().width;
        int h = sObjView.getSize().height;

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;

        SoundObject sObj = sObjView.getSoundObject();

        if (sObjView.isSelected()) {
            bgColor = selectedBgColor;
            border1 = selectedBorder1;
            border2 = selectedBorder2;
            fontColor = selectedFontColor;
        } else {
            bgColor = sObj.getBackgroundColor();
            border1 = bgColor.brighter().brighter();
            border2 = bgColor.darker().darker();

            int total = bgColor.getRed() + bgColor.getGreen()
                    + bgColor.getBlue();

            if (total > 128 * 3) {
                fontColor = Color.black;
            } else {
                fontColor = Color.white;
            }

        }

        g.setPaint(bgColor);

        g.fillRect(clip.x, 2, clip.width, h - 4);

        // Draw Waveform

        g.setPaint(fontColor);

        paintWaveform(g, sObjView, pixelSeconds);

        // DRAW BORDERS
//        if (GeneralSettings.getInstance().isDrawFlatSObjBorders()) {
//            g.setColor(Color.LIGHT_GRAY);
//            g.drawRect(0, 2, w - 1, h - 4);
//
//        } else {
            g.setColor(border1);
            g.drawLine(0, 2, w - 1, 2);
            g.drawLine(0, 2, 0, h - 4);

            g.setColor(border2);
            g.drawLine(0, h - 3, w, h - 3);
            g.drawLine(w - 1, h - 3, w - 1, 2);
//        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String parts[] = sObjView.getSoundObject().getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 15 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], labelOffset, y);
            }
        }
    }

    private void paintWaveform(Graphics2D g, SoundObjectView sObjView,
            int pixelSeconds) {

        AudioFile audioFile = (AudioFile) sObjView.getSoundObject();

        String audioFilename = audioFile.getSoundFileName();
        int sObjVisibleHeight = sObjView.getHeight() - 4;

        AudioWaveformData waveData = (AudioWaveformData) sObjView
                .getClientProperty(AUDIO_WAVEFORM_DATA);

        if (waveData == null) {
            waveData = waveCache.getAudioWaveformData(audioFilename,
                    pixelSeconds);

            if (waveData.percentLoadingComplete < 1.0) {
                waveCache.addAudioWaveformListener(new AudioWaveformListener(
                        audioFilename, sObjView));
            }

            sObjView.putClientProperty(AUDIO_WAVEFORM_DATA, waveData);
        } else if (waveData.pixelSeconds != pixelSeconds
                || !waveData.fileName.equals(audioFile.getSoundFileName())) {
            waveCache.removeReference(waveData);

            waveData = waveCache.getAudioWaveformData(audioFilename,
                    pixelSeconds);
            sObjView.putClientProperty(AUDIO_WAVEFORM_DATA, waveData);

            if (waveData.percentLoadingComplete < 1.0) {
                waveCache.addAudioWaveformListener(new AudioWaveformListener(
                        audioFilename, sObjView));
            }
        }

        g.translate(1, 2);

        paintWaveForm(g, sObjVisibleHeight, waveData);

        g.translate(-1, -2);

    }

    private void paintWaveForm(Graphics2D g, int sObjVisibleHeight,
            AudioWaveformData waveForm) {

        if (waveForm.data == null) {
            return;
        }

        // if (waveForm.percentLoadingComplete < 1.0) {
        // return;
        // }

        Rectangle bounds = g.getClipBounds();

        int startX = bounds.x; // + 1;
        int endX = startX + bounds.width;

        if (startX < 0) {
            startX = 0;
        }

        // System.out.println(startX + " : " + endX + " : " + bounds);

        int index;

        int channelHeight = sObjVisibleHeight / waveForm.data.length;
        int middleZero = channelHeight / 2;

        for (int j = 0; j < waveForm.data.length; j++) {
            int yAdjust = j * channelHeight;

            for (int i = startX; i < endX; i++) {
                index = i * 2;

                if (index + 1 > waveForm.data[j].length) {
                    break;
                }

                // if(index + 1 > waveForm.data[j].length) {
                // break;
                // }

                int y1 = (int) (middleZero - (waveForm.data[j][index] * middleZero))
                        + yAdjust;
                int y2 = (int) (middleZero - (waveForm.data[j][index + 1] * middleZero))
                        + yAdjust;

                g.drawLine(i, y1, i, y2);

            }
        }
    }

    public void cleanup(SoundObjectView sObjView) {
        AudioWaveformData waveData = (AudioWaveformData) sObjView
                .getClientProperty(AUDIO_WAVEFORM_DATA);

        if (waveData != null) {
            waveCache.removeReference(waveData);
        }
        sObjView.putClientProperty(AUDIO_WAVEFORM_DATA, null);
    }

    public Class getSoundObjectClass() {
        return AudioFile.class;
    }
}
