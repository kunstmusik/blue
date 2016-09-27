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
import blue.blueLive.LiveObjectBins;
import blue.blueLive.LiveObjectSetList;
import blue.soundObject.SoundObject;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Map;

public class LiveData {

    private String commandLine = "csound -Wdo devaudio -L stdin";
    private int tempo = 60;
    private int repeat = 4;
    private LiveObjectBins liveObjectBins;
    private LiveObjectSetList liveObjectSets;
    private boolean commandLineEnabled = false;
    private boolean commandLineOverride = false;
    private boolean repeatEnabled = false;

    public LiveData() {
        liveObjectBins = new LiveObjectBins();
        liveObjectSets = new LiveObjectSetList();
    }

    public LiveData(LiveData liveData) {
        commandLine = liveData.commandLine;
        tempo = liveData.tempo;
        repeat = liveData.repeat;
        commandLineEnabled = liveData.commandLineEnabled;
        commandLineOverride = liveData.commandLineOverride;
        repeatEnabled = liveData.repeatEnabled;
        liveObjectBins = new LiveObjectBins(liveData.liveObjectBins);
        liveObjectSets = new LiveObjectSetList(liveData.liveObjectSets);
    }

    public String getCommandLine() {
        return commandLine;
    }

    public void setCommandLine(String string) {
        commandLine = string;
    }

    public LiveObjectBins getLiveObjectBins() {
        return liveObjectBins;
    }

    public LiveObjectSetList getLiveObjectSets() {
        return liveObjectSets;
    }

    public int getRepeat() {
        return repeat;
    }

    public void setRepeat(int repeat) {
        this.repeat = repeat;
    }

    public int getTempo() {
        return tempo;
    }

    public void setTempo(int tempo) {
        this.tempo = tempo;
    }

    public static LiveData loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        LiveData liveData = new LiveData();

        Elements nodes = data.getElements();

        boolean doCommandLineUpgrade = true;

        ArrayList<LiveObject> oldFormat = new ArrayList<>();

        Element liveObjectSetsNode = null;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String name = node.getName();
            switch (name) {
                case "commandLine":
                    liveData.setCommandLine(node.getTextString());
                    break;
                case "commandLineEnabled":
                    liveData.setCommandLineEnabled(XMLUtilities.readBoolean(node));
                    doCommandLineUpgrade = false;
                    break;
                case "commandLineOverride":
                    liveData.setCommandLineOverride(XMLUtilities.readBoolean(node));
                    doCommandLineUpgrade = false;
                    break;
                case "soundObject":
                    SoundObject sObj = (SoundObject) ObjectUtilities.loadFromXML(
                            node, objRefMap);
                    LiveObject lObj = new LiveObject();
                    lObj.setSObj(sObj);
                    oldFormat.add(lObj);
                    break;
                case "liveObject":
                    oldFormat.add(LiveObject.loadFromXML(node,
                            objRefMap));
                    break;
                case "liveObjectBins":
                    liveData.liveObjectBins = LiveObjectBins.loadFromXML(node,
                            objRefMap);
                    break;
                case "repeat":
                    liveData.repeat = XMLUtilities.readInt(node);
                    break;
                case "tempo":
                    liveData.tempo = XMLUtilities.readInt(node);
                    break;
                case "liveObjectSetList":
                    liveObjectSetsNode = node;
                    break;
                case "repeatEnabled":
                    liveData.setRepeatEnabled(XMLUtilities.readBoolean(node));
                    break;
            }

        }

        if (oldFormat.size() > 0) {
            LiveObject[][] liveObjectBins = new LiveObject[1][oldFormat.size()];

            for (int i = 0; i < oldFormat.size(); i++) {
                liveObjectBins[0][i] = oldFormat.get(i);
            }
            liveData.liveObjectBins = new LiveObjectBins(liveObjectBins);
        }

        if (doCommandLineUpgrade) {
            liveData.setCommandLineEnabled(true);
            liveData.setCommandLineOverride(true);
        }

        if (liveObjectSetsNode != null) {

            liveData.liveObjectSets = LiveObjectSetList.loadFromXML(liveObjectSetsNode, liveData.liveObjectBins);

        }

        return liveData;
    }

    /**
     * @return
     */
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = new Element("liveData");

        retVal.addElement("commandLine").setText(commandLine);
        retVal.addElement(XMLUtilities.writeBoolean("commandLineEnabled",
                commandLineEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("commandLineOverride",
                commandLineOverride));

        retVal.addElement(liveObjectBins.saveAsXML(objRefMap));
        retVal.addElement(liveObjectSets.saveAsXML());

        retVal.addElement(XMLUtilities.writeInt("repeat", repeat));
        retVal.addElement(XMLUtilities.writeInt("tempo", tempo));
        retVal.addElement(XMLUtilities.writeBoolean("repeatEnabled",
                repeatEnabled));

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

    public boolean isRepeatEnabled() {
        return repeatEnabled;
    }

    public void setRepeatEnabled(boolean repeatEnabled) {
        this.repeatEnabled = repeatEnabled;
    }

}
