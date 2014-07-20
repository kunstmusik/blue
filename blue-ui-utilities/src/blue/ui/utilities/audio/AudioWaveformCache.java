package blue.ui.utilities.audio;

import java.io.File;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Vector;

public class AudioWaveformCache {

    public static final AudioWaveformData EMPTY_AUDIO_FILENAME = new AudioWaveformData();

    public static final AudioWaveformData NOT_YET_CACHED = new AudioWaveformData();

    private final HashMap<AudioWaveformData, Integer> refCountCache =
            new HashMap<>();

    private Vector listeners = null;

    private AudioWaveformCacheGenerator generator = null;

    private static AudioWaveformCache INSTANCE = null;

    public static synchronized AudioWaveformCache getInstance() {
        if(INSTANCE == null) {
            INSTANCE = new AudioWaveformCache();
        }

        return INSTANCE;
    }
    
    private AudioWaveformCache() {}
    
    public synchronized AudioWaveformData getAudioWaveformData(
            String audioFilename, int pixelSeconds) {

        if (audioFilename == null || audioFilename.length() == 0) {
            return EMPTY_AUDIO_FILENAME;
        }

        AudioWaveformData waveData = findAudioWaveformData(audioFilename,
                pixelSeconds);

        if (waveData != null) {
            // System.out.println("Wave Data Not Null\n" + waveData);
            Integer refCount = (Integer) refCountCache.get(waveData);
            refCountCache.put(waveData, new Integer(refCount.intValue() + 1));
            // System.out.println(refCountCache);
            return waveData;
        }

        waveData = new AudioWaveformData();
        waveData.fileName = audioFilename;
        waveData.pixelSeconds = pixelSeconds;
        waveData.data = null;
        waveData.percentLoadingComplete = 0.0;

        File f = new File(audioFilename);

        if (!f.exists() && !f.isFile()) {
            refCountCache.put(waveData, new Integer(1));
            // System.out.println(refCountCache);
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

        refCountCache.put(waveData, new Integer(1));
        // System.out.println(refCountCache);
        return waveData;
    }

    public synchronized void removeReference(AudioWaveformData audioWaveformData) {
        if (audioWaveformData == EMPTY_AUDIO_FILENAME) {
            return;
        }

        if (!refCountCache.containsKey(audioWaveformData)) {
            return;
        }

        Integer count = (Integer) refCountCache.get(audioWaveformData);

        if (count == null || count.intValue() - 1 <= 0) {
            refCountCache.remove(audioWaveformData);
        } else {
            refCountCache.put(audioWaveformData, new Integer(
                    count.intValue() - 1));
        }

        // System.out.println(refCountCache);
    }

    public synchronized void clearCache() {
        refCountCache.clear();
        if (listeners != null) {
            listeners.clear();
        }
    }

    private synchronized AudioWaveformData findAudioWaveformData(
            String audioFilename, int pixelSeconds) {

        if (refCountCache.size() == 0) {
            return null;
        }

        for (Iterator iter = refCountCache.keySet().iterator(); iter.hasNext();) {
            AudioWaveformData data = (AudioWaveformData) iter.next();

            // System.out.println(data);

            if (data.fileName.equals(audioFilename)
                    && data.pixelSeconds == pixelSeconds) {
                return data;
            }
        }

        return null;
    }

    public synchronized void addAudioWaveformListener(
            AudioWaveformListener audioWaveformListener) {
        if (listeners == null) {
            listeners = new Vector();
        }

        listeners.add(audioWaveformListener);
    }

    public synchronized void fireAudioWaveformDataGenerated(String filename) {

        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if (filename == AudioWaveformCacheGenerator.CACHE_GEN_COMPLETE) {
            for (Iterator iterator = new Vector(listeners).iterator(); iterator
                    .hasNext();) {
                AudioWaveformListener listener = (AudioWaveformListener) iterator
                        .next();
                listener.waveDataGenerated();
            }
            listeners.clear();
            return;
        }

        for (Iterator iterator = new Vector(listeners).iterator(); iterator
                .hasNext();) {
            AudioWaveformListener listener = (AudioWaveformListener) iterator
                    .next();
            if (listener.getFilename().equals(filename)) {
                listener.waveDataGenerated();
            }
        }
    }
}