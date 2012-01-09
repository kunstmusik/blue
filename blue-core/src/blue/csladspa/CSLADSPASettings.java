/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2008 Steven Yi (stevenyi@gmail.com)
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
package blue.csladspa;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import org.apache.commons.lang.text.StrBuilder;

/**
 *
 * @author SYi
 */
public class CSLADSPASettings implements Serializable {

    private String name;
    private String maker;
    private int uniqueId;
    private String copyright;
    private boolean enabled;
    private PortDefinitionList portDefinitionList;
    
    public CSLADSPASettings() {
        this(true);
    }

    public CSLADSPASettings(boolean initialize) {
        if (initialize) {
            this.name = "";
            this.maker = "";
            this.uniqueId = 0;
            this.copyright = "";
            this.portDefinitionList = new PortDefinitionList();
        }
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getMaker() {
        return maker;
    }

    public void setMaker(String maker) {
        this.maker = maker;
    }

    public int getUniqueId() {
        return uniqueId;
    }

    public void setUniqueId(int uniqueId) {
        this.uniqueId = uniqueId;
    }

    public String getCopyright() {
        return copyright;
    }

    public void setCopyright(String copyright) {
        this.copyright = copyright;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }    
    
    public PortDefinitionList getPortDefinitionList() {
        return portDefinitionList;
    }
    
    public String getCSDText() {
        StrBuilder builder = new StrBuilder();
        
        builder.append("<csLADSPA>\n");
        builder.append("Name=").append(this.name).append("\n");
        builder.append("Maker=").append(this.maker).append("\n");
        builder.append("UniqueID=").append(this.uniqueId).append("\n");
        builder.append("Copyright=").append(this.copyright).append("\n");
        builder.append(portDefinitionList.getCSDText());
        
        builder.append("</csLADSPA>\n");
        
        return builder.toString();
    }    
    
    /* SERIALIZATION METHODS */

    public static CSLADSPASettings loadFromXML(Element data) {
        CSLADSPASettings retVal = new CSLADSPASettings(false);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            String nodeName = node.getName();
            String nodeVal = node.getTextString();

            if (nodeName.equals("name")) {
                retVal.name = nodeVal;
            } else if (nodeName.equals("maker")) {
                retVal.maker = nodeVal;
            } else if (nodeName.equals("uniqueId")) {
                retVal.uniqueId = Integer.parseInt(nodeVal);
            } else if (nodeName.equals("copyright")) {
                retVal.copyright = nodeVal;
            } else if (nodeName.equals("enabled")) {
                retVal.enabled = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("portDefinitionList")) {
                retVal.portDefinitionList = PortDefinitionList.loadFromXML(node);
            }
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("csladspaSettings");

        retVal.addElement("name").setText(name);
        retVal.addElement("maker").setText(maker);
        retVal.addElement(XMLUtilities.writeInt("uniqueId", uniqueId));
        retVal.addElement("copyright").setText(copyright);
        retVal.addElement(portDefinitionList.saveAsXML());
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));
        
        return retVal;
    }
    
}
