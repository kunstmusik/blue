package blue;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

import blue.soundObject.SoundObject;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.rmi.dgc.VMID;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;


public final class SoundObjectLibrary extends ArrayList<SoundObject> {

    private boolean initializing = false;
    
    private transient ArrayList<ChangeListener> listeners = 
            new ArrayList<ChangeListener>();

    public SoundObjectLibrary() {

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
        int size = this.size();

        for (int i = 0; i < size; i++) {
            if (this.get(i) == sObj) {
                this.remove(i);
                fireChangeEvent();
                return true;
            }
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
        for(ChangeListener cl : listeners) {
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
            SoundObject sObj = (SoundObject) ObjectUtilities.loadFromXML(
                    node, objRefMap);
            sObjLib.add(sObj);
            
            if(node.getAttribute("objRefId") != null) {
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

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            SoundObject sObj = (SoundObject) iter.next();
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

}