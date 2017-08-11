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
package blue.automation;

import electric.xml.Element;
import electric.xml.Elements;
import java.util.*;
import javafx.beans.property.SimpleListProperty;
import javafx.collections.FXCollections;
import javafx.collections.transformation.SortedList;
import org.apache.commons.lang3.text.StrBuilder;

public class ParameterList extends SimpleListProperty<Parameter> {

    private static final Comparator<Parameter> COMPARATOR = new Comparator<Parameter>() {
        @Override
        public int compare(Parameter o1, Parameter o2) {
            Parameter para1 = o1;
            Parameter para2 = o2;

            return para1.getName().compareToIgnoreCase(para2.getName());

        }
    };

    public ParameterList() {
        super(FXCollections.observableArrayList());
    }

    public ParameterList(ParameterList pl) {
        super(FXCollections.observableArrayList());
        for (Parameter param : pl) {
            add(new Parameter(param));
        }
    }

    @Override
    public SortedList<Parameter> sorted() {
        return super.sorted(COMPARATOR); 
    }

    public Parameter getParameter(String objectName) {
        for (Parameter param : this) {
            if (param.getName().equals(objectName)) {
                return param;
            }
        }
        return null;
    }

    public void removeParameter(String parameterName) {

        for (Parameter param : this) {
            if (param.getName().equals(parameterName)) {
                remove(param);
                break;
            }
        }
    }

    public void clearCompilationVarNames() {
        for (Parameter param : this) {
            param.setCompilationVarName(null);
        }
    }

    /* SERIALIZATION CODE */
    public Element saveAsXML() {
        Element retVal = new Element("parameterList");

        for (Parameter param : this) {
            retVal.addElement(param.saveAsXML());
        }

        return retVal;
    }

    public static ParameterList loadFromXML(Element data) {
        ParameterList retVal = new ParameterList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {

            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("parameter")) {
                retVal.add(Parameter.loadFromXML(node));
            }

        }

        return retVal;
    }

    @Override
    public boolean equals(Object obj) {
        return super.equals(obj);
    }

    @Override
    public String toString() {
        StrBuilder buffer = new StrBuilder();

        for (Parameter param : this) {
            buffer.append(param.toString()).append("\n");
        }
        return buffer.toString();
    }

}
