/*
 * blue - object composition environment for csound
 * Copyright (c) 2007 Steven Yi (stevenyi@gmail.com)
 *
 * Based on CMask by Andre Bartetzki
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
package blue.soundObject.jmask;

import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.utility.NumberUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.ListModel;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Field implements Serializable, ListModel {

    ArrayList<Parameter> parameters = new ArrayList<>();

    private transient Vector listListeners = null;

    public Field() {
        this(true);
    }

    private Field(boolean init) {
        if (init) {
            parameters.add(Parameter.create(new Constant()));
            parameters.add(Parameter.create(new Constant()));
            parameters.add(Parameter.create(new Constant()));

            parameters.get(0).setName("Instrument ID");
            parameters.get(1).setName("Start");
            parameters.get(2).setName("Duration");
        }
    }

    public static Field loadFromXML(Element data) throws Exception {
        Field field = new Field(false);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("parameter")) {
                field.parameters.add(Parameter.loadFromXML(node));
            }
        }

        return field;
    }

    public void pushUp(int index) {
        if (index > 0 && index < parameters.size()) {
            Parameter val = parameters.remove(index);
            parameters.add(index - 1, val);

            ListDataEvent lde = new ListDataEvent(this,
                    ListDataEvent.CONTENTS_CHANGED, index - 1, index);
            fireContentsChangedEvent(lde);
        }
    }

    public void pushDown(int index) {
        if (index >= 0 && index < parameters.size() - 1) {
            Parameter val = parameters.remove(index + 1);
            parameters.add(index, val);

            ListDataEvent lde = new ListDataEvent(this,
                    ListDataEvent.CONTENTS_CHANGED, index, index + 1);
            fireContentsChangedEvent(lde);
        }
    }

    public Element saveAsXML() {
        Element retVal = new Element("field");

        for (Iterator it = parameters.iterator(); it.hasNext();) {
            Parameter param = (Parameter) it.next();

            retVal.addElement(param.saveAsXML());
        }

        return retVal;
    }

    public NoteList generateNotes(final double duration, java.util.Random rnd) {
        NoteList nl = new NoteList();

        double xt = 0.0;
        int numFields = parameters.size();

        for (int i = 0; i < parameters.size(); i++) {
            getParameter(i).initialize(duration);
        }

        while (xt < duration) {

            Note n = Note.createNote(numFields);

            double p1 = getParameter(0).getValue(xt, rnd);
            p1 = p1 < 1.0 ? 1.0 : Utilities.round(p1, 0);

            n.setPField(NumberUtilities.formatDouble(p1), 1);
            n.setPField(NumberUtilities.formatDouble(xt), 2);

            for (int i = 3; i < numFields + 1; i++) {
                double val = getParameter(i - 1).getValue(xt, rnd);

                if (i == 3 && val < 0) {
                    n.setPField(NumberUtilities.formatDouble(-val), i);
                    n.setTied(true);
                } else {
                    n.setPField(NumberUtilities.formatDouble(val), i);
                }

            }

            double p2 = getParameter(1).getValue(xt, rnd);
            if (p2 == 0.0) {
                System.err.println("[JMask] - WARNING: p2 = 0 !");
            }

            xt += p2;

            nl.add(n);
        }

        return nl;
    }

    // Fields
    public Parameter getParameter(int index) {
        return (Parameter) parameters.get(index);
    }

    public Parameter removeParameter(int index) {
        Parameter retVal = (Parameter) parameters.remove(index);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_REMOVED, index, index);
        fireRemoveDataEvent(lde);

        return retVal;
    }

    public void addParameterBefore(int index, Generator gen) {
        Parameter param = Parameter.create(gen);
        parameters.add(index, param);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_ADDED, index, index);
        fireAddDataEvent(lde);
    }

    public void addParameterAfter(int index, Generator gen) {
        Parameter param = Parameter.create(gen);
        parameters.add(index + 1, param);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_ADDED, index + 1, index + 1);
        fireAddDataEvent(lde);
    }

    public void changeParameter(int index, Generator gen) {
        Parameter param = Parameter.create(gen);
        parameters.remove(index);
        parameters.add(index, param);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.CONTENTS_CHANGED, index, index);
        fireContentsChangedEvent(lde);
    }

    // List Model Methods
    @Override
    public int getSize() {
        return parameters.size();
    }

    @Override
    public Object getElementAt(int index) {
        return parameters.get(index);
    }

    @Override
    public void addListDataListener(ListDataListener l) {
        if (listListeners == null) {
            listListeners = new Vector();
        }

        listListeners.add(l);
    }

    @Override
    public void removeListDataListener(ListDataListener l) {
        if (listListeners != null) {
            listListeners.remove(l);
        }
    }

    private void fireAddDataEvent(ListDataEvent lde) {
        if (listListeners == null) {
            return;
        }

        Iterator iter = new Vector(listListeners).iterator();

        while (iter.hasNext()) {
            ListDataListener listener = (ListDataListener) iter.next();
            listener.intervalAdded(lde);
        }
    }

    private void fireRemoveDataEvent(ListDataEvent lde) {
        if (listListeners == null) {
            return;
        }

        Iterator iter = new Vector(listListeners).iterator();

        while (iter.hasNext()) {
            ListDataListener listener = (ListDataListener) iter.next();
            listener.intervalRemoved(lde);
        }
    }

    private void fireContentsChangedEvent(ListDataEvent lde) {
        if (listListeners == null) {
            return;
        }

        Iterator iter = new Vector(listListeners).iterator();

        while (iter.hasNext()) {
            ListDataListener listener = (ListDataListener) iter.next();
            listener.contentsChanged(lde);
        }
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}
