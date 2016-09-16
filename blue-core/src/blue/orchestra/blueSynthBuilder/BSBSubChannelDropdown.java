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
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public class BSBSubChannelDropdown extends BSBObject {

    private StringProperty channelOutput;

    public BSBSubChannelDropdown() {
        channelOutput = new SimpleStringProperty(Channel.MASTER);
    }

    public final void setChannelOutput(String value) {
        channelOutput.set(value);
    }

    public final String getChannelOutput() {
        return channelOutput.get();
    }

    public final StringProperty channelOutputProperty() {
        return channelOutput;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBSubChannelDropdown dropDown = new BSBSubChannelDropdown();
        initBasicFromXML(data, dropDown);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element elem = nodes.next();
            String name = elem.getName();

            if (name.equals("channelOutput")) {
                dropDown.setChannelOutput(elem.getTextString());
            }
        }

        return dropDown;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("channelOutput").setText(getChannelOutput());

        return retVal;
    }

    @Override
    public String getPresetValue() {
        return null;
    }

    @Override
    public void setPresetValue(String val) {
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        compilationUnit.addReplacementValue(objectName, getChannelOutput());
    }
}
