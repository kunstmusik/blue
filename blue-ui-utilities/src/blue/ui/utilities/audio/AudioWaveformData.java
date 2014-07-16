/**
 *
 */
package blue.ui.utilities.audio;

public class AudioWaveformData {
    public volatile double percentLoadingComplete = 0.0;

    public String fileName;

    public boolean valid = true;

    public int pixelSeconds;

    /** Channels x datapairs (equal 2 * width for min/max pairs) */
    public double[][] data;

    @Override
    public String toString() {
        return "[AudioWaveformData] - " + fileName + " : " + pixelSeconds;
    }
}
