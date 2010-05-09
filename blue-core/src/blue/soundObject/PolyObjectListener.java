package blue.soundObject;

import blue.SoundLayer;

public interface PolyObjectListener {
    public void soundLayerAdded(SoundLayer sLayer);

    public void soundLayerRemoved(SoundLayer sLayer);
}
