package blue.ui.utilities.audio;

import javax.swing.JComponent;

public class AudioWaveformListener {
    private final String filename;

    private final JComponent view;

    public AudioWaveformListener(String filename, JComponent view) {
        this.filename = filename;
        this.view = view;
    }

    public void waveDataGenerated() {
        this.view.repaint();
    }

    public String getFilename() {
        return this.filename;
    }
}
