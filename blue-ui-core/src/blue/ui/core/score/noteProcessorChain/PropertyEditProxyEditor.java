/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.score.noteProcessorChain;

import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.EventObject;
import java.util.Vector;

import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.event.CellEditorListener;
import javax.swing.event.ChangeEvent;
import javax.swing.table.TableCellEditor;

import blue.noteProcessor.Code;
import blue.soundObject.pianoRoll.Scale;


class PropertyEditProxyEditor implements TableCellEditor, ActionListener {

    protected transient Vector listeners = new Vector();

    // JCheckBox checkBox = new JCheckBox();
    JTextField textField = new JTextField();

    ScaleEditor scaleEditor = new ScaleEditor();

    CodeEditor codeEditor = new CodeEditor();

    // JTextField numberField = new JTextField();
    // JComboBox comboBox = new JComboBox();

    EditorDelegate textDelegate;

    EditorDelegate scaleDelegate;

    EditorDelegate codeDelegate;

    Component editor;

    EditorDelegate delegate;

    public PropertyEditProxyEditor() {
        textField.addActionListener(this);
        textField.setBorder(null);

        scaleEditor.addActionListener(this);

        textDelegate = new EditorDelegate() {
            public void setValue(Object value) {
                textField.setText((value != null) ? value.toString() : "");
            }

            public Object getValue() {
                return textField.getText();
            }
        };

        scaleDelegate = new EditorDelegate() {

            public void setValue(Object val) {
                scaleEditor.setScale((Scale) val);
            }

            public Object getValue() {
                return scaleEditor.getScale();
            }

        };

        codeDelegate = new EditorDelegate() {

            public void setValue(Object val) {
                codeEditor.setCode((Code) val);
            }

            public Object getValue() {
                return codeEditor.getCode();
            }

        };
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.table.TableCellEditor#getTableCellEditorComponent(javax.swing.JTable,
     *      java.lang.Object, boolean, int, int)
     */
    public Component getTableCellEditorComponent(JTable table, Object value,
            boolean isSelected, int row, int column) {
        editor = getCellEditorComponent(value);
        delegate = getEditorDelegate(value);

        editor.setVisible(true);

        delegate.setValue(value);

        return editor;
    }

    private Component getCellEditorComponent(Object obj) {
        /*
         * if(obj instanceof PropertyEditProxy) { PropertyEditProxy proxy =
         * (PropertyEditProxy)obj; return
         * getCellEditorComponent(proxy.getValue()); } else
         */

        if (obj instanceof File) {

        } else if (obj instanceof Boolean) {
            // return checkBox;
        } else if (obj instanceof Number) {
            // return numberField;
        } else if (obj instanceof Scale) {
            return scaleEditor;
        } else if (obj instanceof Code) {
            return codeEditor;
        }

        return textField;
    }

    private EditorDelegate getEditorDelegate(Object obj) {
        if (obj instanceof File) {

        } else if (obj instanceof Boolean) {
            // return checkBox;
        } else if (obj instanceof Number) {
            // return numberField;
        } else if (obj instanceof Scale) {
            return scaleDelegate;
        } else if (obj instanceof Code) {
            return codeDelegate;
        }

        return textDelegate;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.CellEditor#cancelCellEditing()
     */
    public void cancelCellEditing() {
        fireEditingCanceled();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.CellEditor#stopCellEditing()
     */
    public boolean stopCellEditing() {
        fireEditingStopped();
        return true;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.CellEditor#getCellEditorValue()
     */
    public Object getCellEditorValue() {
        if (delegate == null) {
            return null;
        }
        return delegate.getValue();
    }

    public boolean isCellEditable(EventObject anEvent) {
        return true;
    }

    public boolean shouldSelectCell(EventObject anEvent) {
        return true;
    }

    public void addCellEditorListener(CellEditorListener l) {
        listeners.addElement(l);
    }

    public void removeCellEditorListener(CellEditorListener l) {
        listeners.remove(l);
    }

    private void fireEditingCanceled() {
        ChangeEvent ce = new ChangeEvent(this);
        for (int i = listeners.size() - 1; i >= 0; i--) {
            CellEditorListener listener = (CellEditorListener) listeners.get(i);
            listener.editingCanceled(ce);
        }
        if (editor != null) {
            editor.setVisible(false);
        }
    }

    private void fireEditingStopped() {
        ChangeEvent ce = new ChangeEvent(this);
        for (int i = listeners.size() - 1; i >= 0; i--) {
            CellEditorListener listener = (CellEditorListener) listeners.get(i);
            listener.editingStopped(ce);
        }
        if (editor != null) {
            editor.setVisible(false);
        }
    }

    interface EditorDelegate {

        public void setValue(Object val);

        public Object getValue();
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.awt.event.ActionListener#actionPerformed(java.awt.event.ActionEvent)
     */
    public void actionPerformed(ActionEvent e) {
        fireEditingStopped();
    }
}