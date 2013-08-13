package blue.components;

import blue.BlueSystem;
import java.awt.BorderLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.beans.BeanInfo;
import java.beans.IntrospectionException;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.InvocationTargetException;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.table.AbstractTableModel;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class PropertyEditor extends JComponent {
    JScrollPane jScrollPane1 = new JScrollPane();

    BorderLayout borderLayout1 = new BorderLayout();

    public JTable propertyTable = new JTable();

    PropertyEditTableModel propTableModel = new PropertyEditTableModel();

    public PropertyEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(borderLayout1);
        this.add(jScrollPane1, BorderLayout.CENTER);
        jScrollPane1.getViewport().add(propertyTable, null);
        propertyTable.setModel(propTableModel);
        propertyTable.getTableHeader().setReorderingAllowed(false);
    }

    public void editObject(Object obj) {
        if (propertyTable.isEditing()) {
            propertyTable.getCellEditor().cancelCellEditing();
        }
        propTableModel.setObject(obj);
    }

    public static void main(String args[]) {
        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);
        PropertyEditor a = new PropertyEditor();
        mFrame.getContentPane().add(a);

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
        // a.editObject(new TestObject());
        a.editObject(new blue.noteProcessor.MultiplyProcessor());
    }
}

class PropertyEditTableModel extends AbstractTableModel {

    private static String PROPERTY = null;

    private static String VALUE = null;

    Object obj;

    PropertyDescriptor[] props = null;

    public PropertyEditTableModel() {
        if (PROPERTY == null) {
            PROPERTY = BlueSystem.getString("propertyEditor.property");
        }
        if (VALUE == null) {
            VALUE = BlueSystem.getString("propertyEditor.value");
        }
    }

    public void setObject(Object obj) {
        this.obj = obj;

        if (obj == null) {
            props = null;
        } else {

            try {
                BeanInfo info = Introspector.getBeanInfo(obj.getClass());
                props = info.getPropertyDescriptors();
            } catch (IntrospectionException e) {
                e.printStackTrace();
            }
        }

        this.fireTableDataChanged();
    }

    @Override
    public String getColumnName(int i) {
        if (i == 0) {
            return "Property";
        }
        return "Value";
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public Object getValueAt(int row, int column) {
        if (this.obj == null) {
            return null;
        }

        PropertyDescriptor temp = props[row];

        Object retVal = null;

        if (column == 0) {
            retVal = temp.getName();
        } else {
            try {
                retVal = temp.getReadMethod().invoke(temp, null);
            } catch (IllegalArgumentException e) {
                e.printStackTrace();
            } catch (IllegalAccessException e) {
                e.printStackTrace();
            } catch (InvocationTargetException e) {
                e.printStackTrace();
            }
        }

        return retVal;
    }

    @Override
    public int getRowCount() {
        if (props == null) {
            return 0;
        }
        return props.length;
    }

    @Override
    public boolean isCellEditable(int r, int c) {
        if (c == 1) {
            return true;
        }
        return false;
    }

    @Override
    public Class getColumnClass(int c) {
        return getValueAt(0, 1).getClass();
    }

    @Override
    public void setValueAt(Object value, int row, int col) {

        if (this.obj == null) {
            return;
        }

        if (col == 1) {
            try {
                Object[] args = new Object[1];
                args[0] = value;

                PropertyDescriptor temp = props[row];
                temp.getWriteMethod().invoke(temp, args);
            } catch (Exception e) {
                // swallow exception: this just won't let the property be set,
                // and the table will be updated,
                // the old value
            }
        }
        fireTableCellUpdated(row, col);
    }

}

class TestObject {
    boolean b = false;

    String yo = "yo";

    int i = 1;

    float f = 0.0f;

    public boolean getB() {
        return b;
    }

    public void setB(boolean val) {
        b = val;
    }
}