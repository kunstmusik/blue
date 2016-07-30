/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.blueSynthBuilder;

import blue.automation.Parameter;
import blue.automation.ParameterList;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * Listens to BSBGraphic Interface changes
 * 
 * @author steven
 */
public class BSBParameterList extends ParameterList implements
        BSBGraphicInterfaceListener {

    // BSBGraphicInterface bsbInterface = null;

    public void setBSBGraphicInterface(BSBGraphicInterface bsbInterface) {
        bsbInterface.addBSBGraphicInterfaceListener(this);

        for (int i = 0; i < bsbInterface.size(); i++) {
            BSBObject bsbObj = bsbInterface.getBSBObject(i);

            if (bsbObj instanceof AutomatableBSBObject) {
                AutomatableBSBObject autoBsb = (AutomatableBSBObject) bsbObj;
                autoBsb.setBSBParameterList(this);
            }
        }
    }

    public void bsbObjectAdded(BSBObject bsbObj) {
        if (bsbObj instanceof AutomatableBSBObject) {
            AutomatableBSBObject autoBsb = (AutomatableBSBObject) bsbObj;
            autoBsb.setBSBParameterList(this);
        }
    }

    public void bsbObjectRemoved(BSBObject bsbObj) {
        String[] keys = bsbObj.getReplacementKeys();

        if (keys == null) {
            return;
        }

        for (int i = 0; i < keys.length; i++) {
            if (keys[i] == null || keys[i].length() == 0) {
                continue;
            }
            this.removeParameter(keys[i]);
        }
    }

    @Override
    public Element saveAsXML() {
        Element retVal = super.saveAsXML();
        retVal.setName("bsbParameterList");

        return retVal;
    }

    public static ParameterList loadFromXML(Element data) {
        BSBParameterList retVal = new BSBParameterList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {

            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("parameter")) {
                retVal.addParameter(Parameter.loadFromXML(node));
            }

        }

        return retVal;
    }

}
