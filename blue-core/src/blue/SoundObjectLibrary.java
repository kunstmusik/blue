package blue;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

import java.util.ArrayList;
import java.util.Iterator;

import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;

public final class SoundObjectLibrary extends ArrayList {

    private boolean initializing = false;

    public SoundObjectLibrary() {

    }

    public void addSoundObject(SoundObject sObj) {
        sObj.setStartTime(0.0f);
        this.add(sObj);
    }

    public SoundObject getSoundObject(int index) {
        return (SoundObject) (this.get(index));
    }

    public boolean removeSoundObject(SoundObject sObj) {
        int size = this.size();

        for (int i = 0; i < size; i++) {
            if (this.getSoundObject(i) == sObj) {
                this.remove(i);
                return true;
            }
        }
        return false;
    }

    public static SoundObjectLibrary loadFromXML(Element data) throws Exception {
        SoundObjectLibrary sObjLib = new SoundObjectLibrary();
        sObjLib.setInitializing(true);

        Elements sObjects = data.getElements("soundObject");

        while (sObjects.hasMoreElements()) {
            SoundObject sObj = (SoundObject) ObjectUtilities.loadFromXML(
                    sObjects.next(), sObjLib);
            sObjLib.addSoundObject(sObj);
        }

        sObjLib.setInitializing(false);

        sObjLib.resolveLibraryInstances();

        return sObjLib;
    }

    private void resolveLibraryInstances() {
        for (int i = 0; i < this.size(); i++) {
            SoundObject sObj = getSoundObject(i);

            if (sObj instanceof Instance) {
                ((Instance) sObj).resolve(this);
            } else if (sObj instanceof PolyObject) {
                resolveLibraryInstances((PolyObject) sObj);
            }
        }
    }

    private void resolveLibraryInstances(PolyObject pObj) {
        ArrayList sObjects = pObj.getSoundObjects(true);

        for (int i = 0; i < sObjects.size(); i++) {
            Object sObj = sObjects.get(i);

            if (sObj instanceof Instance) {
                ((Instance) sObj).resolve(this);
            } else if (sObj instanceof PolyObject) {
                resolveLibraryInstances((PolyObject) sObj);
            }
        }
    }

    public Element saveAsXML() {
        Element retVal = new Element("soundObjectLibrary");

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            SoundObject sObj = (SoundObject) iter.next();
            retVal.addElement(sObj.saveAsXML(this));
        }

        return retVal;
    }

    public int getSoundObjectLibraryID(SoundObject sObj) {
        return this.indexOf(sObj);
    }

    public SoundObject getSoundObjectByID(int id) {
        return this.getSoundObject(id);
    }

    public boolean isInitializing() {
        return initializing;
    }

    public void setInitializing(boolean initializing) {
        this.initializing = initializing;
    }

}