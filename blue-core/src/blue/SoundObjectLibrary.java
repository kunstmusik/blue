package blue;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.rmi.dgc.VMID;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public final class SoundObjectLibrary extends ArrayList<SoundObject> {

    private boolean initializing = false;

    private transient ArrayList<ChangeListener> listeners
            = new ArrayList<>();

    public SoundObjectLibrary() {
    }

    public SoundObjectLibrary(SoundObjectLibrary sObjLib) {
        super(sObjLib.size());
        for(SoundObject sObj :sObjLib) {
            add(sObj.deepCopy());
        }
    }

    public void addSoundObject(SoundObject sObj) {
        sObj.setStartTime(0.0f);
        this.add(sObj);
        fireChangeEvent();
    }

    public SoundObject getSoundObject(int index) {
        return this.get(index);
    }

    public boolean removeSoundObject(SoundObject sObj) {
        if (this.contains(sObj)) {
            remove(sObj);
            fireChangeEvent();
            return true;
        }
        return false;
    }

    /* LISTENER CODE */
    public void addChangeListener(ChangeListener cl) {
        listeners.add(cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        listeners.remove(cl);
    }

    public void fireChangeEvent() {
        ChangeEvent ce = new ChangeEvent(this);
        for (ChangeListener cl : listeners) {
            cl.stateChanged(ce);
        }
    }

    /* SERIALIZATION CODE */
    public static SoundObjectLibrary loadFromXML(Element data, Map<String, Object> objRefMap) throws Exception {
        SoundObjectLibrary sObjLib = new SoundObjectLibrary();
        sObjLib.setInitializing(true);

        Elements sObjects = data.getElements("soundObject");

        int index = 0;

        while (sObjects.hasMoreElements()) {
            Element node = sObjects.next();

            // For corrupt projects that have Instances within the library, 
            // skip adding of Instance but increment index
            if ("blue.soundObject.Instance".equals(
                    node.getAttributeValue("type"))) {
                index++;
                continue;
            }

            SoundObject sObj = (SoundObject) ObjectUtilities.loadFromXML(
                    node, objRefMap);
            sObjLib.add(sObj);

            if (node.getAttribute("objRefId") != null) {
                objRefMap.put(node.getAttributeValue("objRefId"), sObj);
            } else {
                objRefMap.put(Integer.toString(index++), sObj);
            }
        }

        sObjLib.setInitializing(false);

        return sObjLib;
    }

    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = new Element("soundObjectLibrary");

        for (SoundObject sObj : this) {
            String objRefId = Integer.toString(new VMID().hashCode());
            objRefMap.put(sObj, objRefId);

            Element elem = sObj.saveAsXML(objRefMap);
            elem.setAttribute("objRefId", objRefId);
            retVal.addElement(elem);
        }

        return retVal;
    }

    public boolean isInitializing() {
        return initializing;
    }

    public void setInitializing(boolean initializing) {
        this.initializing = initializing;
    }

    public void checkAndAddInstanceSoundObjects(List<Instance> instanceSoundObjects) {
        Map<SoundObject, SoundObject> originalToCopyMap = new HashMap<>();

        for (Instance instance : instanceSoundObjects) {
            final SoundObject instanceSObj = instance.getSoundObject();
            if (!this.contains(instanceSObj)) {
                SoundObject copy;

                if (originalToCopyMap.containsKey(instanceSObj)) {
                    copy = originalToCopyMap.get(instanceSObj);
                } else {
                    copy = instance.getSoundObject().deepCopy();
                    this.addSoundObject(copy);
                    originalToCopyMap.put(instanceSObj, copy);
                }

                instance.setSoundObject(copy);
            }
        }
    }
}
