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
import org.apache.commons.lang3.text.StrBuilder;

/**
 *
 * @author SYi
 */
public class PortDefinition implements Serializable {

    private String displayName;
    private String channelName;
    private float rangeMin;
    private float rangeMax;
    private boolean logarithmic;

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getChannelName() {
        return channelName;
    }

    public void setChannelName(String channelName) {
        this.channelName = channelName;
    }

    public float getRangeMin() {
        return rangeMin;
    }

    public void setRangeMin(float rangeMin) {
        this.rangeMin = rangeMin;
    }

    public float getRangeMax() {
        return rangeMax;
    }

    public void setRangeMax(float rangeMax) {
        this.rangeMax = rangeMax;
    }

    public boolean isLogarithmic() {
        return logarithmic;
    }

    public void setLogarithmic(boolean logarithmic) {
        this.logarithmic = logarithmic;
    }

    public String getCSDText() {
        StrBuilder builder = new StrBuilder();
        
        builder.append("ControlPort=").append(this.displayName);
        builder.append("|").append(this.channelName).append("\n");
        builder.append("Range=").append(this.rangeMin);
        builder.append("|").append(this.rangeMax);
        
        if(this.logarithmic) {
            builder.append(" &log");
        }
        
        builder.append("\n");
        
        return builder.toString();
    }
    
    
    /* SERIALIZATION METHODS */

    public static PortDefinition loadFromXML(Element data) {
        PortDefinition retVal = new PortDefinition();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            String nodeName = node.getName();
            String nodeVal = node.getTextString();

            if (nodeName.equals("displayName")) {
                retVal.displayName = nodeVal;
            } else if (nodeName.equals("channelName")) {
                retVal.channelName = nodeVal;
            } else if (nodeName.equals("rangeMin")) {
                retVal.rangeMin = Float.parseFloat(nodeVal);
            } else if (nodeName.equals("rangeMax")) {
                retVal.rangeMax = Float.parseFloat(nodeVal);
            } else if (nodeName.equals("logarithmic")) {
                retVal.logarithmic = Boolean.valueOf(nodeVal).booleanValue();
            } 
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("portDefinition");

        retVal.addElement("displayName").setText(displayName);
        retVal.addElement("channelName").setText(channelName);
        retVal.addElement(XMLUtilities.writeFloat("rangeMin", rangeMin));
        retVal.addElement(XMLUtilities.writeFloat("rangeMax", rangeMax));
        retVal.addElement(XMLUtilities.writeBoolean("logarithmic", logarithmic));

        return retVal;
    }
}
