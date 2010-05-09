/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.csladspa;

import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import org.apache.commons.lang.text.StrBuilder;

/**
 *
 * @author syi
 */
public class PortDefinitionList implements Serializable, TableModel {

    private transient Vector listeners;
    private ArrayList portDefinitions = new ArrayList();

    public void addPortDefinition(PortDefinition pd) {
        portDefinitions.add(pd);
        fireTableDataChanged();
    }
    
    public PortDefinition getPortDefinition(int index) {
        return (PortDefinition)portDefinitions.get(index);
    }
    
    public int size() {
        return portDefinitions.size();
    }
    
    public void addPortDefinition(int index) {
        if (index < 0 || index >= portDefinitions.size()) {
            portDefinitions.add(new PortDefinition());
        } else {
            portDefinitions.add(index, new PortDefinition());
        }
        fireTableDataChanged();
    }

    public void removePortDefinition(int index) {
        if (index >= 0 && index < portDefinitions.size()) {
            portDefinitions.remove(index);
            fireTableDataChanged();
        }
    }

    public void pushUpPortDefinition(int[] rows) {
        Object a = portDefinitions.remove(rows[0] - 1);
        portDefinitions.add(rows[rows.length - 1], a);
        this.fireTableDataChanged();
    }

    public void pushDownPortDefinition(int[] rows) {
        Object a = portDefinitions.remove(rows[rows.length - 1] + 1);
        portDefinitions.add(rows[0], a);
        this.fireTableDataChanged();

    }

    public int getRowCount() {
        return portDefinitions.size();
    }

    public int getColumnCount() {
        return 5;
    }

    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return "Display Name";
            case 1:
                return "Channel Name";
            case 2:
                return "Range Min";
            case 3:
                return "Range Max";
            case 4:
                return "Logarithmic";
        }
        return null;
    }

    public Class getColumnClass(int columnIndex) {
        switch (columnIndex) {
            case 0:
            case 1:
                return String.class;
            case 2:
            case 3:
                return Float.class;
            case 4:
                return Boolean.class;
        }
        return null;
    }

    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    public Object getValueAt(int rowIndex, int columnIndex) {
        PortDefinition pd = (PortDefinition) portDefinitions.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return pd.getDisplayName();
            case 1:
                return pd.getChannelName();
            case 2:
                return new Float(pd.getRangeMin());
            case 3:
                return new Float(pd.getRangeMax());
            case 4:
                return Boolean.valueOf(pd.isLogarithmic());
        }
        return null;
    }

    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        PortDefinition pd = (PortDefinition) portDefinitions.get(rowIndex);

        switch (columnIndex) {
            case 0:
                pd.setDisplayName((String) aValue);
                break;
            case 1:
                pd.setChannelName((String) aValue);
                break;
            case 2:
                pd.setRangeMin(((Float) aValue).floatValue());
                break;
            case 3:
                pd.setRangeMax(((Float) aValue).floatValue());
                break;
            case 4:
                pd.setLogarithmic(((Boolean) aValue).booleanValue());
        }
    }

    /* TABLE MODEL METHODS */
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

    public void removeTableModelListener(TableModelListener l) {
        if (listeners == null) {
            return;
        }
        listeners.remove(l);
    }

    private void fireTableDataChanged() {
        if (listeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this);

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();

            listener.tableChanged(tme);
        }
    }

    public String getCSDText() {
        StrBuilder builder = new StrBuilder();

        for (Iterator it = portDefinitions.iterator(); it.hasNext();) {
            PortDefinition pd = (PortDefinition) it.next();

            builder.append(pd.getCSDText());
        }


        return builder.toString();
    }

    /* SAVE/LOAD METHODS */
    public static PortDefinitionList loadFromXML(Element data) {
        PortDefinitionList retVal = new PortDefinitionList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            PortDefinition pd = PortDefinition.loadFromXML(node);
            retVal.portDefinitions.add(pd);

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("portDefinitionList");

        for (Iterator iter = portDefinitions.iterator(); iter.hasNext();) {
            PortDefinition pd = (PortDefinition) iter.next();
            retVal.addElement(pd.saveAsXML());
        }

        return retVal;
    }
}
