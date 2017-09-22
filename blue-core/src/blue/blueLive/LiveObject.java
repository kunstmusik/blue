/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.blueLive;

import blue.soundObject.SoundObject;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.rmi.dgc.VMID;
import java.util.Map;

/**
 * 
 * @author steven
 */
public class LiveObject {

    private SoundObject sObj = null;

    private int midiTrigger = -1;

    private int keyTrigger = -1;
    
    private boolean enabled = false;
    
    private String uniqueId;

    /** Creates a new instance of LiveObject */
    public LiveObject() {
        uniqueId = Integer.toString(new VMID().hashCode());
    }

    public LiveObject(SoundObject sObj) {
        this();
        this.sObj = sObj;
    }

    public LiveObject(LiveObject liveObj) {
        // FIXME - double check that this is correct
        uniqueId = liveObj.uniqueId; 
        midiTrigger = liveObj.midiTrigger;
        keyTrigger = liveObj.keyTrigger;
        enabled = liveObj.enabled;

        if(liveObj.sObj != null){
            sObj = liveObj.sObj.deepCopy();
        }
    }

    public SoundObject getSoundObject() {
        return sObj;
    }

    public void setSObj(SoundObject sObj) {
        this.sObj = sObj;
    }

    public int getMidiTrigger() {
        return midiTrigger;
    }

    public void setMidiTrigger(int midiTrigger) {
        this.midiTrigger = midiTrigger;
    }

    public int getKeyTrigger() {
        return keyTrigger;
    }

    public void setKeyTrigger(int keyTrigger) {
        this.keyTrigger = keyTrigger;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
    
    public String getUniqueId() {
        return uniqueId;
    }

    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = new Element("liveObject");
        
        retVal.setAttribute("uniqueId", uniqueId);

        retVal.addElement(XMLUtilities.writeInt("keyTrigger", keyTrigger));
        retVal.addElement(XMLUtilities.writeInt("midiTrigger", midiTrigger));
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));
        retVal.addElement(this.sObj.saveAsXML(objRefMap));

        return retVal;
    }

    public static LiveObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        LiveObject liveObj = new LiveObject();
        
        String val = data.getAttributeValue("uniqueId");
        if (val != null && val.length() > 0) {
            liveObj.uniqueId = val;
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String name = node.getName();
            switch (name) {
                case "keyTrigger":
                    liveObj.setKeyTrigger(XMLUtilities.readInt(node));
                    break;
                case "midiTrigger":
                    liveObj.setMidiTrigger(XMLUtilities.readInt(node));
                    break;
                case "soundObject":
                    liveObj.setSObj((SoundObject) ObjectUtilities.loadFromXML(node,
                            objRefMap));
                    break;
                case "enabled":
                    liveObj.setEnabled(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        return liveObj;
    }
}
