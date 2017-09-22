/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.mixer;

import blue.automation.Automatable;
import blue.automation.AutomatableCollectionListener;
import blue.utility.ListUtil;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Vector;
import javax.swing.ListModel;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class EffectsChain implements ListModel, PropertyChangeListener {

    private ArrayList effects = new ArrayList();

    private transient List<ListDataListener> listeners = null;

    private transient List<AutomatableCollectionListener> automatableCollectionListeners = null;

    public EffectsChain() {
    }

    public EffectsChain(EffectsChain chain) {
        for(Object item : chain.effects) {
            if(item instanceof Effect) {
                addEffect(new Effect((Effect)item));
            } else if (item instanceof Send){
                addSend(new Send((Send)item));
            } 
        }
    }

    public Element saveAsXML() {
        Element retVal = new Element("effectsChain");

        for (Iterator it = effects.iterator(); it.hasNext();) {
            Object obj = it.next();

            if (obj instanceof Effect) {
                Effect elem = (Effect) obj;
                retVal.addElement(elem.saveAsXML());
            } else if (obj instanceof Send) {
                Send send = (Send) obj;
                retVal.addElement(send.saveAsXML());
            }
        }

        return retVal;
    }

    public static EffectsChain loadFromXML(Element data) throws Exception {
        EffectsChain chain = new EffectsChain();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "effect":
                    chain.addEffect(Effect.loadFromXML(node));
                    break;
                case "send":
                    chain.addSend(Send.loadFromXML(node));
                    break;
            }
        }

        return chain;
    }

    public void addEffect(Effect effect) {
        effects.add(effect);
        int val = effects.indexOf(effect);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_ADDED, val, val);

        fireAddDataEvent(lde);

        fireAutomatableAdded(effect);
    }

    public void addSend(Send send) {
        effects.add(send);
        int val = effects.indexOf(send);

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_ADDED, val, val);

        fireAddDataEvent(lde);

        fireAutomatableAdded(send);

        send.addPropertyChangeListener(this);
    }

    public Object removeElementAt(int index) {
        Object obj = effects.remove(index);

        if (obj instanceof Send) {
            ((Send) obj).removePropertyChangeListener(this);
        }

        ListDataEvent lde = new ListDataEvent(this,
                ListDataEvent.INTERVAL_REMOVED, index, index);

        fireRemoveDataEvent(lde);

        fireAutomatableRemoved((Automatable) obj);

        return obj;
    }

    public int size() {
        return effects.size();
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public void pushUp(int index) {
        if (index > 0 && index < size()) {
            Object a = effects.remove(index - 1);
            effects.add(index, a);

            ListDataEvent lde = new ListDataEvent(this,
                    ListDataEvent.CONTENTS_CHANGED, index - 1, index);

            fireContentsChangedEvent(lde);
        }
    }

    public void pushDown(int index) {
        if (index < size() - 1) {
            Object a = effects.remove(index + 1);
            effects.add(index, a);

            ListDataEvent lde = new ListDataEvent(this,
                    ListDataEvent.CONTENTS_CHANGED, index - 1, index);

            fireContentsChangedEvent(lde);
        }
    }

    public Send[] getSends() {
        ArrayList<Send> temp = new ArrayList<>();

        for (int i = 0; i < this.size(); i++) {
            Object obj = this.getElementAt(i);

            if (obj instanceof Send) {
                temp.add((Send) obj);
            }
        }

        Send[] sends = new Send[temp.size()];
        sends = temp.toArray(sends);

        return sends;
    }

    /* List Model Methods */
    @Override
    public int getSize() {
        return effects.size();
    }

    @Override
    public Object getElementAt(int index) {
        return effects.get(index);
    }

    @Override
    public void addListDataListener(ListDataListener l) {
        if (listeners == null) {
            listeners = new Vector<>();
        }

        listeners.add(l);
    }

    @Override
    public void removeListDataListener(ListDataListener l) {
        if (listeners != null) {
            listeners.remove(l);
        }
    }

    private void fireAddDataEvent(ListDataEvent lde) {
        if (listeners == null) {
            return;
        }

        for (ListDataListener listener : listeners) {
            listener.intervalAdded(lde);
        }
    }

    private void fireRemoveDataEvent(ListDataEvent lde) {
        if (listeners == null) {
            return;
        }

        for (ListDataListener listener : listeners) {
            listener.intervalRemoved(lde);
        }
    }

    private void fireContentsChangedEvent(ListDataEvent lde) {
        if (listeners == null) {
            return;
        }

        for (ListDataListener listener : listeners) {
            listener.contentsChanged(lde);
        }
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public void addAutomatableCollectionListener(
            AutomatableCollectionListener listener) {
        if (automatableCollectionListeners == null) {
            automatableCollectionListeners = new Vector<>();
        }
        automatableCollectionListeners.add(listener);
    }

    public void removeAutomatableCollectionListener(
            AutomatableCollectionListener listener) {
        if (automatableCollectionListeners != null) {
            automatableCollectionListeners.remove(listener);
        }
    }

    private void fireAutomatableAdded(Automatable automatable) {
        if (automatableCollectionListeners != null) {

            for (AutomatableCollectionListener listener : automatableCollectionListeners) {
                listener.automatableAdded(automatable);
            }
        }
    }

    private void fireAutomatableRemoved(Automatable automatable) {
        if (automatableCollectionListeners != null) {
            for (AutomatableCollectionListener listener : automatableCollectionListeners) {
                listener.automatableRemoved(automatable);
            }
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getPropertyName().equals("sendChannel")) {
            Object obj = evt.getSource();

            int index = ListUtil.indexOfByRef(effects, obj);

            if (index >= 0) {
                ListDataEvent lde = new ListDataEvent(this,
                        ListDataEvent.CONTENTS_CHANGED, index, index);

                fireContentsChangedEvent(lde);
            }
        }
    }
}
