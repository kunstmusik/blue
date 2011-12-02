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

package blue.soundObject.ceciliaModule;

import java.util.StringTokenizer;

import electric.xml.Element;

public class CPopup extends CeciliaObject {

    int index = 0;

    public static void main(String[] args) {
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#processText(java.lang.String)
     */
    public String processText(String ceciliaText) {
        // TODO Auto-generated method stub
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#initialize(java.lang.String[])
     */
    public void initialize(String[] tokens) {
        this.setObjectName(tokens[1]);

        StringTokenizer st = null;
        String initialVal = null;

        for (int i = 2; i < tokens.length; i += 2) {
            if (tokens[i].equals("-label")) {
                // ignore
            } else if (tokens[i].equals("-value")) {
                st = new StringTokenizer(tokens[i + 1]);
            } else if (tokens[i].equals("-init")) {
                initialVal = tokens[i + 1];
            }
        }

        if (st == null || initialVal == null) {
            return;
        }

        int i = 0;
        while (st.hasMoreTokens()) {
            if (st.nextToken().equals(initialVal)) {
                this.setIndex(i);
                return;
            }
            i++;
        }
    }

    /**
     * @return Returns the index.
     */
    public int getIndex() {
        return index;
    }

    /**
     * @param index
     *            The index to set.
     */
    public void setIndex(int index) {
        this.index = index;
    }

    public static CeciliaObject loadFromXML(Element data) {
        CPopup cObj = new CPopup();

        CeciliaObject.initBasicFromXML(data, cObj);

        cObj.setIndex(Integer.parseInt(data.getTextString("index")));

        return cObj;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.ceciliaModule.CeciliaObject#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = CeciliaObject.getBasicXML(this);

        retVal.addElement("index").setText(Integer.toString(this.getIndex()));

        return retVal;
    }
}