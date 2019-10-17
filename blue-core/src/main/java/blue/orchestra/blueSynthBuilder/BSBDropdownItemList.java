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
import java.util.ArrayList;
import java.util.Iterator;
import javafx.beans.property.SimpleListProperty;
import javafx.collections.FXCollections;

/**
 * @author steven
 */
public class BSBDropdownItemList extends SimpleListProperty<BSBDropdownItem> {

    public BSBDropdownItemList(){
        super(FXCollections.observableArrayList());    
    }

    public BSBDropdownItemList(BSBDropdownItemList list) {
        this();
        for(BSBDropdownItem item :list) {
            add(new BSBDropdownItem(item)); 
        } 
    }

    public static BSBDropdownItemList loadFromXML(Element data) {
        BSBDropdownItemList list = new BSBDropdownItemList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element elem = nodes.next();
            String name = elem.getName();

            if (name.equals("bsbDropdownItem")) {
                list.add(BSBDropdownItem.loadFromXML(elem));
            }
        }

        return list;
    }

    public Element saveAsXML() {
        Element retVal = new Element("bsbDropdownItemList");

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            BSBDropdownItem item = (BSBDropdownItem) iter.next();
            retVal.addElement(item.saveAsXML());
        }

        return retVal;
    }

    @Override
    public String toString() {
        return "Dropdown Items";
    }
}
