package blue.ui.utilities.audio;

import java.io.File;
import java.io.IOException;
import java.lang.ref.SoftReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.apache.commons.io.FileUtils;

public class AudioWaveformCache {

    public static final AudioWaveformData EMPTY_AUDIO_FILENAME = new AudioWaveformData();

    public static final AudioWaveformData NOT_YET_CACHED = new AudioWaveformData();

    private final Map<WaveformCacheKey, SoftReference<AudioWaveformData>> waveCache
            = new HashMap<>();

    private List<AudioWaveformListener> listeners = null;

    private AudioWaveformCacheGenerator generator = null;

    private static AudioWaveformCache INSTANCE = null;

    public static synchronized AudioWaveformCache getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new AudioWaveformCache();
        }

        return INSTANCE;
    }

    private AudioWaveformCache() {
    }

    public synchronized AudioWaveformData getAudioWaveformData(
            String audioFilename, double pixelSeconds) {

        if (audioFilename == null || audioFilename.length() == 0) {
            return EMPTY_AUDIO_FILENAME;
        }

        File f = new File(audioFilename);
        long checksum = 0;

        if (f.exists() && f.isFile()) {
            try {
                checksum = FileUtils.checksumCRC32(f);
            } catch (IOException ex) {
                Logger.getLogger(AudioWaveformCache.class.getName()).log(Level.SEVERE, null, ex);
            }
        }

        WaveformCacheKey key = new WaveformCacheKey(audioFilename,
                checksum,
                pixelSeconds);

        SoftReference<AudioWaveformData> waveDataRef = waveCache.get(key);

        if (waveDataRef != null && waveDataRef.get() != null) {
            return waveDataRef.get();
        }

        AudioWaveformData waveData = new AudioWaveformData();
        waveData.fileName = audioFilename;
        waveData.pixelSeconds = pixelSeconds;
        waveData.data = null;
        waveData.percentLoadingComplete = 0.0;

        if (!f.exists() && !f.isFile()) {
            waveCache.put(new WaveformCacheKey(audioFilename, checksum, pixelSeconds),
                    new SoftReference<>(waveData));
            return waveData;
        }

        if (generator == null || !generator.isRunning()) {
            // System.out.println("New Generator");
            generator = new AudioWaveformCacheGenerator(this);
            generator.addAudioWaveformData(waveData);
            generator.start();
        } else if (generator.getPixelSeconds() != waveData.pixelSeconds) {
            // System.out.println("Creating New Generator");
            generator.killRunning();
            this.clearCache();
            generator = new AudioWaveformCacheGenerator(this);
            generator.addAudioWaveformData(waveData);
            generator.start();
        } else {
            // System.out.println("Adding to Generator");
            generator.addAudioWaveformData(waveData);
        }

        waveCache.put(new WaveformCacheKey(audioFilename, checksum, pixelSeconds),
                new SoftReference<>(waveData));
        // System.out.println(refCountCache);
        return waveData;
    }

    public synchronized void clearCache() {
        waveCache.clear();
        if (listeners != null) {
            listeners.clear();
        }
    }

    public synchronized void addAudioWaveformListener(
            AudioWaveformListener audioWaveformListener) {
        if (listeners == null) {
            listeners = Collections.synchronizedList(new ArrayList<>());
        }

        listeners.add(audioWaveformListener);
    }

    public synchronized void fireAudioWaveformDataGenerated(String filename) {

        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if (filename == AudioWaveformCacheGenerator.CACHE_GEN_COMPLETE) {
            for (AudioWaveformListener listener : listeners) {
                listener.waveDataGenerated();
            }
            listeners.clear();
            return;
        }

        for (AudioWaveformListener listener : listeners) {
            if (listener.getFilename().equals(filename)) {
                listener.waveDataGenerated();
            }
        }
    }
}
