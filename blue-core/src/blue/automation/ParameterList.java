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
import java.io.Serializable;
import java.util.*;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.text.StrBuilder;

public class ParameterList implements Serializable {
    private static final Comparator<Parameter> comparator = new Comparator<Parameter>() {
        public int compare(Parameter o1, Parameter o2) {
            Parameter para1 = o1;
            Parameter para2 = o2;

            return para1.getName().compareToIgnoreCase(para2.getName());

        }
    };

    ArrayList<Parameter> parameters = new ArrayList<Parameter>();

    transient Vector<ParameterListListener> paramListListeners = null;

    transient Vector tableListeners = null;

    public Parameter getParameter(int index) {
        return parameters.get(index);
    }

    public Parameter getParameter(String objectName) {
        for (int i = 0; i < size(); i++) {
            Parameter param = getParameter(i);
            if (param.getName().equals(objectName)) {
                return param;
            }
        }
        return null;
    }

    public ArrayList<Parameter> getParameters() {
        return parameters;
    }

    public void addParameter(Parameter param) {
        parameters.add(param);

        Collections.<Parameter>sort(parameters, comparator);

        fireParameterAdded(param);
    }

    public void removeParameter(String parameterName) {
        for (int i = 0; i < size(); i++) {
            Parameter param = getParameter(i);
            
            if (param.getName().equals(parameterName)) {
                parameters.remove(i);
                fireParameterRemoved(param);
                return;
            }
        }
    }

    public void removeParameter(int index) {
        Parameter param = parameters.get(index);

        parameters.remove(index);
        fireParameterRemoved(param);
    }

    public int size() {
        return parameters.size();
    }
    
    public void clearCompilationVarNames() {
        for (int i = 0; i < size(); i++) {
            Parameter param = getParameter(i);
            param.setCompilationVarName(null);
        }
    }

    /* SERIALIZATION CODE */

    public Element saveAsXML() {
        Element retVal = new Element("parameterList");

        for (int i = 0; i < size(); i++) {
            Parameter param = getParameter(i);
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
                retVal.addParameter(Parameter.loadFromXML(node));
            }

        }

        return retVal;
    }

    /* PARAMETER LIST LISTENER CODE */

    public void addParameterListListener(ParameterListListener l) {
        if (paramListListeners == null) {
            paramListListeners = new Vector<ParameterListListener>();
        }
        paramListListeners.add(l);
    }

    public void removeParameterListListener(ParameterListListener l) {
        if (paramListListeners != null) {
            paramListListeners.remove(l);
        }
    }

    private void fireParameterAdded(Parameter param) {
        if (paramListListeners != null) {
            Iterator<ParameterListListener> iter = new Vector<ParameterListListener>(paramListListeners).iterator();
            while (iter.hasNext()) {
                ParameterListListener listener = iter.next();
                listener.parameterAdded(param);
            }
        }
    }

    private void fireParameterRemoved(Parameter param) {
        if (paramListListeners != null) {
			

            Iterator<ParameterListListener> iter = new Vector<ParameterListListener>(paramListListeners).iterator();
            while (iter.hasNext()) {
                ParameterListListener listener = iter.next();
                listener.parameterRemoved(param);
            }
        }
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        StrBuilder buffer = new StrBuilder();

        for (Iterator iter = parameters.iterator(); iter.hasNext();) {
            Parameter param = (Parameter) iter.next();
            buffer.append(param.toString()).append("\n");

        }
        return buffer.toString();
    }

    public int indexOf(Parameter currentParameter) {
        return parameters.indexOf(currentParameter);
    }
}
