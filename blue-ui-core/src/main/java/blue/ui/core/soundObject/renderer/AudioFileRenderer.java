package blue.ui.core.soundObject.renderer;

import blue.BlueSystem;
import blue.plugin.BarRendererPlugin;
import blue.score.layers.Layer;
import blue.soundObject.AudioFile;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
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

@BarRendererPlugin(scoreObjectType = AudioFile.class)
public class AudioFileRenderer implements BarRenderer {

    private static final String AUDIO_WAVEFORM_DATA = "audioWaveformData";

    protected int labelOffset = 5;

    private static Font renderFont = new Font("Dialog", Font.BOLD, 12);

    protected static Color selectedBgColor = new Color(255, 255, 255, 128);

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.darkGray;

    protected static AudioWaveformCache waveCache = AudioWaveformCache.getInstance();

    private boolean isBright(Color c) {
        return c.getRed() + c.getGreen() + c.getBlue() > (128 * 3);
    }

    @Override
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
        Color waveColor;

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

            fontColor = isBright(bgColor) ? Color.BLACK : Color.WHITE;

        }

        if (isBright(bgColor)) {
            waveColor = bgColor.brighter().brighter();
        } else {
            waveColor = bgColor.darker().darker();
        }

        g.setPaint(bgColor);

        g.fillRect(clip.x, 2, clip.width, h - 4);

        // Draw Waveform
        g.setPaint(waveColor);

        paintWaveform(g, sObjView, pixelSeconds);

        // DRAW BORDERS
        g.setColor(border1);
        g.drawLine(0, 2, w, 2);
        g.drawLine(0, 2, 0, h - 2);

        g.setColor(border2);
        g.drawLine(0, h - 2, w, h - 2);
        g.drawLine(w, h - 2, w, 2);

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObjView.getSoundObject().getName().split(
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
            waveData = waveCache.getAudioWaveformData(
                    BlueSystem.getFullPath(audioFilename),
                    pixelSeconds);

            if (waveData.percentLoadingComplete < 1.0) {
                waveCache.addAudioWaveformListener(new AudioWaveformListener(
                        audioFilename, sObjView));
            }

            sObjView.putClientProperty(AUDIO_WAVEFORM_DATA, waveData);
        } else if (waveData.pixelSeconds != pixelSeconds
                || !waveData.fileName.equals(audioFile.getSoundFileName())) {
            waveData = waveCache.getAudioWaveformData(
                    BlueSystem.getFullPath(audioFilename),
                    pixelSeconds);
            sObjView.putClientProperty(AUDIO_WAVEFORM_DATA, waveData);

            if (waveData.percentLoadingComplete < 1.0) {
                waveCache.addAudioWaveformListener(new AudioWaveformListener(
                        audioFilename, sObjView));
            }
        }

        g.translate(1, 2);

        AudioWaveformUI.paintWaveForm(g, sObjVisibleHeight, waveData, 0);

        g.translate(-1, -2);

    }

    @Override
    public void cleanup(SoundObjectView sObjView) {
        sObjView.putClientProperty(AUDIO_WAVEFORM_DATA, null);
    }

}
