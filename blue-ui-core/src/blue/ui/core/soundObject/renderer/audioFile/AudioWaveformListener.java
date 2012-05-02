package blue.ui.core.soundObject.renderer.audioFile;

import blue.ui.core.score.layers.soundObject.SoundObjectView;

public class AudioWaveformListener {
    private final String filename;

    private final SoundObjectView sObjView;

    public AudioWaveformListener(String filename, SoundObjectView sObjView) {
        this.filename = filename;
        this.sObjView = sObjView;
    }

    public void waveDataGenerated() {
        this.sObjView.repaint();
    }

    public String getFilename() {
        return this.filename;
    }
}
