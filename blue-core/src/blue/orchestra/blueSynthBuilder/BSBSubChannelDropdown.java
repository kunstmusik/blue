/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.orchestra.blueSynthBuilder;

import blue.mixer.Channel;
import electric.xml.Element;
import electric.xml.Elements;

public class BSBSubChannelDropdown extends BSBObject {

    String channelOutput = Channel.MASTER;

//    public BSBObjectView getBSBObjectView() {
//        return new BSBSubChannelDropdownView(this);
//    }

    public static BSBObject loadFromXML(Element data) {
        BSBSubChannelDropdown dropDown = new BSBSubChannelDropdown();
        initBasicFromXML(data, dropDown);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element elem = nodes.next();
            String name = elem.getName();

            if (name.equals("channelOutput")) {
                dropDown.channelOutput = elem.getTextString();
            }
        }

        return dropDown;
    }

    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("channelOutput").setText(channelOutput);

        return retVal;
    }

    public String getPresetValue() {
        // return channelOutput;
        return null;
    }

    public void setPresetValue(String val) {
        // BlueSystem.getCurrentBlueData().getMixer().getSubChannels();
    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        compilationUnit.addReplacementValue(objectName, channelOutput);
    }

    public String getChannelOutput() {
        return channelOutput;
    }

    public void setChannelOutput(String channelOutput) {
        if (this.channelOutput.equals(channelOutput)) {
            return;
        }

        String oldChannel = this.channelOutput;
        this.channelOutput = channelOutput;

        if (propListeners != null) {
            propListeners.firePropertyChange("channelOutput", oldChannel,
                    this.channelOutput);
        }
    }
}
