package blue.orchestra;

import blue.Tables;
import blue.utility.ObjectUtilities;
import java.io.IOException;
import java.util.ArrayList;
import java.util.EventListener;
import javax.swing.ListModel;
import javax.swing.event.EventListenerList;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;
import org.apache.commons.lang3.text.StrBuilder;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class InstrumentList extends ArrayList implements ListModel {
    private transient EventListenerList listenerList = new EventListenerList();

    public String generateOrchestra() {
        StrBuilder buffer = new StrBuilder();

        int size = this.size();

        for (int i = 0; i < size; i++) {
            Instrument instr = (Instrument) this.get(i);
            if (instr.isEnabled()) {
                buffer.append("\tinstr ").append(instr.getInstrumentNumber())
                        .append("\t;").append(instr.getName()).append("\n");
                buffer.append(instr.generateInstrument()).append("\n");
                buffer.append("\tendin\n\n");
            }
        }

        return buffer.toString();
    }

    public void generateFTables(Tables tables) {
        int size = this.size();

        for (int i = 0; i < size; i++) {
            Instrument instr = (Instrument) this.get(i);
            if (instr.isEnabled()) {
                instr.generateFTables(tables);
            }
        }
    }

    @Override
    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    /*
     * Code from AbstractListModel - used here to access a private transient
     * listenerList
     */
    @Override
    public int getSize() {
        return this.size();
    }

    @Override
    public Object getElementAt(int i) {
        return this.get(i);
    }

    @Override
    public void addListDataListener(ListDataListener l) {
        listenerList.add(ListDataListener.class, l);
    }

    @Override
    public void removeListDataListener(ListDataListener l) {
        listenerList.remove(ListDataListener.class, l);
    }

    public ListDataListener[] getListDataListeners() {
        return (ListDataListener[]) listenerList
                .getListeners(ListDataListener.class);
    }

    protected void fireContentsChanged(Object source, int index0, int index1) {
        Object[] listeners = listenerList.getListenerList();
        ListDataEvent e = null;

        for (int i = listeners.length - 2; i >= 0; i -= 2) {
            if (listeners[i] == ListDataListener.class) {
                if (e == null) {
                    e = new ListDataEvent(source,
                            ListDataEvent.CONTENTS_CHANGED, index0, index1);
                }
                ((ListDataListener) listeners[i + 1]).contentsChanged(e);
            }
        }
    }

    protected void fireIntervalAdded(Object source, int index0, int index1) {
        Object[] listeners = listenerList.getListenerList();
        ListDataEvent e = null;

        for (int i = listeners.length - 2; i >= 0; i -= 2) {
            if (listeners[i] == ListDataListener.class) {
                if (e == null) {
                    e = new ListDataEvent(source, ListDataEvent.INTERVAL_ADDED,
                            index0, index1);
                }
                ((ListDataListener) listeners[i + 1]).intervalAdded(e);
            }
        }
    }

    protected void fireIntervalRemoved(Object source, int index0, int index1) {
        Object[] listeners = listenerList.getListenerList();
        ListDataEvent e = null;

        for (int i = listeners.length - 2; i >= 0; i -= 2) {
            if (listeners[i] == ListDataListener.class) {
                if (e == null) {
                    e = new ListDataEvent(source,
                            ListDataEvent.INTERVAL_REMOVED, index0, index1);
                }
                ((ListDataListener) listeners[i + 1]).intervalRemoved(e);
            }
        }
    }

    public EventListener[] getListeners(Class listenerType) {
        return listenerList.getListeners(listenerType);
    }

//    public static void main(String args[]) {
//        XMLSerializer xmlSer = new XMLSerializer();
//        try {
//            xmlSer.write(new java.io.PrintWriter(System.out, true),
//                    new InstrumentList());
//        } catch (IOException | IllegalAccessException e) {
//
//        }
//    }

}