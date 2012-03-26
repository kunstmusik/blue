/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.blueLive;

import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;

/**
 *
 * @author stevenyi
 */
public class LiveObjectSetList extends ArrayList<LiveObjectSet> {
    
    
    public static LiveObjectSetList loadFromXML(Element data, LiveObjectBins liveObjectBins) {

        LiveObjectSetList retVal = new LiveObjectSetList();
        
        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String name = node.getName();

            if (name.equals("liveObjectSet")) {
                retVal.add(LiveObjectSet.loadFromXML(node,
                        liveObjectBins));
            }
        }

        return retVal;
        
    }
    
    public Element saveAsXML() {
        Element retVal = new Element("liveObjectSetList");
        
        for(LiveObjectSet set: this) {
            retVal.addElement(set.saveAsXML());
        }
        
        return retVal;
    }
    
}
