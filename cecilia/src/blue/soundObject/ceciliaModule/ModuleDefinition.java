/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.ceciliaModule;

import java.io.Serializable;

import electric.xml.Element;

/**
 * @author steven
 * 
 */
public class ModuleDefinition implements Serializable {
    public String info = "";

    public String tk_interface = "";

    public String mono = "";

    public String stereo = "";

    public String quad = "";

    public String score = "";

    public static ModuleDefinition loadFromXML(Element data) {
        ModuleDefinition moduleDefinition = new ModuleDefinition();

        moduleDefinition.info = data.getTextString("info");
        moduleDefinition.tk_interface = data.getTextString("tk_interface");
        moduleDefinition.mono = data.getTextString("mono");
        moduleDefinition.stereo = data.getTextString("stereo");
        moduleDefinition.quad = data.getTextString("quad");
        moduleDefinition.score = data.getTextString("score");

        return moduleDefinition;
    }

    public Element saveAsXML() {
        Element retVal = new Element("moduleDefinition");

        retVal.addElement("info").setText(info);
        retVal.addElement("tk_interface").setText(tk_interface);
        retVal.addElement("mono").setText(mono);
        retVal.addElement("stereo").setText(stereo);
        retVal.addElement("quad").setText(quad);
        retVal.addElement("score").setText(score);

        return retVal;
    }
}
