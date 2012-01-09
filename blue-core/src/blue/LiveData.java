/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue;

import blue.blueLive.LiveObject;
import blue.soundObject.SoundObject;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;

public class LiveData implements Serializable {

    private String commandLine = "csound -Wdo devaudio -L stdin";

    private ArrayList liveSoundObjects = new ArrayList();

    private boolean commandLineEnabled = false;

    private boolean commandLineOverride = false;

    public String getCommandLine() {
        return commandLine;
    }

    public ArrayList getLiveSoundObjects() {
        return liveSoundObjects;
    }

    public void setCommandLine(String string) {
        commandLine = string;
    }

    public void setLiveSoundObjects(ArrayList list) {
        liveSoundObjects = list;
    }

    public static LiveData loadFromXML(Element data,
            SoundObjectLibrary sObjLibrary) throws Exception {
        LiveData liveData = new LiveData();

        Elements nodes = data.getElements();

        boolean doCommandLineUpgrade = true;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String name = node.getName();

            if (name.equals("commandLine")) {
                liveData.setCommandLine(node.getTextString());
            } else if (name.equals("commandLineEnabled")) {
                liveData.setCommandLineEnabled(XMLUtilities.readBoolean(node));
                doCommandLineUpgrade = false;
            } else if (name.equals("commandLineOverride")) {
                liveData.setCommandLineOverride(XMLUtilities.readBoolean(node));
                doCommandLineUpgrade = false;
            } else if (name.equals("soundObject")) {
                SoundObject sObj = (SoundObject) ObjectUtilities.loadFromXML(
                        node, sObjLibrary);
                LiveObject lObj = new LiveObject();
                lObj.setSObj(sObj);
                liveData.liveSoundObjects.add(lObj);
            } else if (name.equals("liveObject")) {
                liveData.liveSoundObjects.add(LiveObject.loadFromXML(node,
                        sObjLibrary));
            }

        }

        if (doCommandLineUpgrade) {
            liveData.setCommandLineEnabled(true);
            liveData.setCommandLineOverride(true);
        }

        return liveData;
    }

    /**
     * @return
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = new Element("liveData");

        retVal.addElement("commandLine").setText(commandLine);
        retVal.addElement(XMLUtilities.writeBoolean("commandLineEnabled",
                commandLineEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("commandLineOverride",
                commandLineOverride));

        for (Iterator iter = liveSoundObjects.iterator(); iter.hasNext();) {
            LiveObject element = (LiveObject) iter.next();
            retVal.addElement(element.saveAsXML(sObjLibrary));
        }

        return retVal;
    }

    public boolean isCommandLineEnabled() {
        return commandLineEnabled;
    }

    public void setCommandLineEnabled(boolean commandLineEnabled) {
        this.commandLineEnabled = commandLineEnabled;
    }

    public boolean isCommandLineOverride() {
        return commandLineOverride;
    }

    public void setCommandLineOverride(boolean commandLineOverride) {
        this.commandLineOverride = commandLineOverride;
    }

}