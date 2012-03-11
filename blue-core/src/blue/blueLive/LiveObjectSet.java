/*
 * blue - object composition environment for csound
 * Copyright (c) 2012 Steven Yi (stevenyi@gmail.com)
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

/**
 * Class to hold sets of LiveObjects (really is an instance of ArrayList, but 
 * called Set here as that is what it is called by users)
 */
package blue.blueLive;

import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;

/**
 *
 * @author stevenyi
 */
public class LiveObjectSet extends ArrayList<LiveObject> {
    
    public String name = "";

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
    
    public Element saveAsXML() {
         Element retVal = new Element("liveObjectSet");
         retVal.setAttribute("name", name);
         
         for(LiveObject liveObj : this) {
             retVal.addElement("liveObjectRef").setText(liveObj.getUniqueId());
         }

         return retVal;
    }
    
    public static LiveObjectSet loadFromXML(Element data, LiveObjectBins bins) {
        LiveObjectSet retVal = new LiveObjectSet();
        
        String val = data.getAttributeValue("name");
        if (val != null && val.length() > 0) {
            retVal.name = val;
        }
        
        Elements nodes = data.getElements();
        
        while (nodes.hasMoreElements()) {

            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("liveObjectRef")) {
                String uniqueId = node.getTextString();
                LiveObject lObj = bins.getLiveObjectByUniqueId(uniqueId);
                
                if(lObj != null) {
                    retVal.add(lObj);
                }
            }
            
        }
        
        return retVal;
    }
    
}
