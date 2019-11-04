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
package blue.blueLive;

import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.Map;

/**
 *
 * @author stevenyi
 */
public class LiveObjectBins {

    private LiveObject[][] liveObjectBins;

    transient PropertyChangeSupport listeners = new PropertyChangeSupport(this);

    public LiveObjectBins() {
        this(new LiveObject[1][8]);
    }

    public LiveObjectBins(LiveObject[][] liveObjectBins) {
        this.liveObjectBins = liveObjectBins;
    }

    public LiveObjectBins(LiveObjectBins bins) {
        liveObjectBins = bins.liveObjectBins.clone();
        for (int i = 0; i < liveObjectBins.length; i++) {
            for (int j = 0; j < liveObjectBins[i].length; j++) {
                if (bins.liveObjectBins[i][j] != null) {
                    liveObjectBins[i][j] = new LiveObject(bins.liveObjectBins[i][j]);
                }
            }
        }
    }

    public static LiveObjectBins loadFromXML(Element data, Map<String, Object> objRefMap) throws Exception {

        LiveObjectBins retVal;

        if (data.getAttributeValue("columns") != null) {
            int columns = Integer.parseInt(data.getAttributeValue("columns"));
            int rows = Integer.parseInt(data.getAttributeValue("rows"));
            retVal = new LiveObjectBins(new LiveObject[columns][rows]);
        } else {
            throw new Exception("LiveObjectBins could not load");
        }

        Elements nodes = data.getElements();

        int column = 0;

        while (nodes.hasMoreElements()) {

            int row = 0;

            Element node = nodes.next();
            String name = node.getName();

            if (name.equals("bin")) {

                Elements lObjNodes = node.getElements();

                while (lObjNodes.hasMoreElements()) {
                    Element lObjNode = lObjNodes.next();
                    name = lObjNode.getName();

                    if (name.equals("liveObject")) {
                        retVal.liveObjectBins[column][row] = LiveObject.loadFromXML(lObjNode, objRefMap);
                    }
                    row++;
                }
                column++;
            }
        }

        return retVal;
    }

    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = new Element("liveObjectBins");

        retVal.setAttribute("columns", Integer.toString(liveObjectBins.length));
        retVal.setAttribute("rows", Integer.toString(liveObjectBins[0].length));

        for (int i = 0; i < liveObjectBins.length; i++) {

            Element bin = retVal.addElement("bin");

            for (int j = 0; j < liveObjectBins[i].length; j++) {
                LiveObject lObj = liveObjectBins[i][j];

                if (lObj == null) {
                    bin.addElement("null");
                } else {
                    bin.addElement(lObj.saveAsXML(objRefMap));
                }
            }
        }

        return retVal;
    }

    public void setLiveObject(int column, int row, LiveObject liveObject) {
        LiveObject oldObject = liveObjectBins[column][row];

        liveObjectBins[column][row] = liveObject;

        listeners.firePropertyChange("liveObject", oldObject, liveObject);
    }

    public void insertRow(int index) {
        LiveObject[][] newBins = new LiveObject[liveObjectBins.length][liveObjectBins[0].length + 1];

        if (index < 0) {
            index = 0;
        } else if (index > liveObjectBins[0].length) {
            index = liveObjectBins[0].length;
        }

        for (int i = 0; i < newBins.length; i++) {
            int readCounter = 0;

            for (int j = 0; j < newBins[i].length; j++) {
                if (j != index) {
                    newBins[i][j] = liveObjectBins[i][readCounter];
                    readCounter++;
                }
            }
        }

        int oldCount = liveObjectBins[0].length;
        liveObjectBins = newBins;

        listeners.firePropertyChange("rowCount", oldCount, newBins[0].length);
    }

    public void removeRow(int index) {
        if (index < 0 || index >= liveObjectBins[0].length || liveObjectBins[0].length <= 1) {
            return;
        }

        LiveObject[][] newBins = new LiveObject[liveObjectBins.length][liveObjectBins[0].length - 1];

        for (int i = 0; i < liveObjectBins.length; i++) {
            int writeCounter = 0;

            for (int j = 0; j < liveObjectBins[i].length; j++) {
                if (j != index) {
                    newBins[i][writeCounter] = liveObjectBins[i][j];
                    writeCounter++;
                }
            }
        }

        int oldCount = liveObjectBins[0].length;
        liveObjectBins = newBins;

        listeners.firePropertyChange("rowCount", oldCount, newBins[0].length);
    }

    public void insertColumn(int index) {

        LiveObject[][] newBins = new LiveObject[liveObjectBins.length + 1][liveObjectBins[0].length];

        if (index < 0) {
            index = 0;
        } else if (index > liveObjectBins.length) {
            index = liveObjectBins.length;
        }

        int readCounter = 0;
        boolean inserted = false;

        for (int i = 0; i < newBins.length; i++) {
            if (!inserted && readCounter == index) {
                inserted = true;
            } else {
                System.arraycopy(liveObjectBins[readCounter], 0, newBins[i], 0, liveObjectBins[0].length);
                readCounter++;
            }
        }

        int oldCount = liveObjectBins.length;
        liveObjectBins = newBins;

        listeners.firePropertyChange("columnCount", oldCount, newBins.length);
    }

    public void removeColumn(int index) {
        if (index < 0 || index >= liveObjectBins.length || liveObjectBins.length <= 1) {
            return;
        }

        LiveObject[][] newBins = new LiveObject[liveObjectBins.length - 1][liveObjectBins[0].length];

        int writeCounter = 0;
        boolean inserted = false;

        for (int i = 0; i < liveObjectBins.length; i++) {
            if (i != index) {

                System.arraycopy(liveObjectBins[i], 0, newBins[writeCounter], 0, liveObjectBins[0].length);
                writeCounter++;
            }
        }

        int oldCount = liveObjectBins.length;
        liveObjectBins = newBins;

        listeners.firePropertyChange("columnCount", oldCount, newBins.length);
    }

    public int getColumnCount() {
        return liveObjectBins.length;
    }

    public int getRowCount() {
        return liveObjectBins[0].length;
    }

    public LiveObject getLiveObject(int column, int row) {
        return liveObjectBins[column][row];
    }

    public int getColumnForObject(LiveObject liveObject) {
        if (liveObject == null) {
            return -1;
        }

        for (int i = 0; i < liveObjectBins.length; i++) {
            for (int j = 0; j < liveObjectBins[i].length; j++) {
                if (liveObjectBins[i][j] == liveObject) {
                    return i;
                }
            }
        }
        return - 1;
    }

    public int getRowForObject(LiveObject liveObject) {
        if (liveObject == null) {
            return -1;
        }

        for (int i = 0; i < liveObjectBins.length; i++) {
            for (int j = 0; j < liveObjectBins[i].length; j++) {
                if (liveObjectBins[i][j] == liveObject) {
                    return j;
                }
            }
        }
        return -1;
    }

    /* CHANGE LISTENER */
    public void addPropertyChangeListener(PropertyChangeListener cl) {
        listeners.addPropertyChangeListener(cl);
    }

    public void removePropertyChangeListener(PropertyChangeListener cl) {
        listeners.removePropertyChangeListener(cl);
    }

    public LiveObjectSet getEnabledLiveObjectSet() {

        LiveObjectSet retVal = new LiveObjectSet();

        for (int i = 0; i < liveObjectBins.length; i++) {
            for (int j = 0; j < liveObjectBins[0].length; j++) {
                LiveObject lObj = liveObjectBins[i][j];

                if (lObj != null && lObj.isEnabled()) {
                    retVal.add(lObj);
                }
            }
        }

        return retVal;
    }

    public void setEnabledFromLiveObjectSet(LiveObjectSet liveObjectSet) {

        for (int i = 0; i < liveObjectBins.length; i++) {
            for (int j = 0; j < liveObjectBins[0].length; j++) {
                LiveObject lObj = liveObjectBins[i][j];

                if (lObj != null && liveObjectSet.contains(lObj)) {
                    lObj.setEnabled(true);
                } else {
                    lObj.setEnabled(false);
                }
            }
        }

        listeners.firePropertyChange("enabledStateChanged", false, false);

    }

    public LiveObject getLiveObjectByUniqueId(String uniqueId) {

        if (uniqueId == null) {
            return null;
        }

        for (int i = 0; i < liveObjectBins.length; i++) {
            for (int j = 0; j < liveObjectBins[0].length; j++) {
                LiveObject lObj = liveObjectBins[i][j];

                if (lObj != null && uniqueId.equals(lObj.getUniqueId())) {
                    return lObj;
                }
            }
        }

        return null;
    }

}
