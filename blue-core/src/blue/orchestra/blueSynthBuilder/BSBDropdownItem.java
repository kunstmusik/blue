/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.rmi.dgc.VMID;

/**
 * @author Steven Yi
 */
public class BSBDropdownItem implements Serializable {

    String name = "name";

    String value = "value";

    private String uniqueId;

    public BSBDropdownItem() {
        this.uniqueId = Integer.toString(new VMID().hashCode());
    }

    public BSBDropdownItem(BSBDropdownItem item) {
       this();
       name = item.name;
       value = item.value;
    }

    public static BSBDropdownItem loadFromXML(Element data) {
        BSBDropdownItem item = new BSBDropdownItem();

        String uniqueId = data.getAttributeValue("uniqueId");
        if (uniqueId != null && uniqueId.length() > 0) {
            item.uniqueId = uniqueId;
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element elem = nodes.next();
            String name = elem.getName();
            switch (name) {
                case "name":
                    item.setName(elem.getTextString());
                    break;
                case "value":
                    item.setValue(elem.getTextString());
                    break;
            }
        }

        return item;
    }

    public Element saveAsXML() {
        Element retVal = new Element("bsbDropdownItem");

        retVal.setAttribute("uniqueId", uniqueId);

        retVal.addElement("name").setText(this.getName());
        retVal.addElement("value").setText(this.getValue());

        return retVal;
    }

    public String getUniqueId() {
        return uniqueId;
    }

    /**
     * @return Returns the name.
     */
    public String getName() {
        return name;
    }

    /**
     * @param name
     *            The name to set.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * @return Returns the value.
     */
    public String getValue() {
        return value;
    }

    /**
     * @param value
     *            The value to set.
     */
    public void setValue(String value) {
        this.value = value;
    }

    @Override
    public String toString() {
        return name;
    }
}