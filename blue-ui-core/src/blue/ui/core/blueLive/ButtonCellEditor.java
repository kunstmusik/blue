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

package blue.ui.core.blueLive;

import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.DefaultCellEditor;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JTable;

/**
 * Modified from http://www.codeguru.com/java/articles/129.shtml
 */
/**
 * @version 1.0 11/09/98
 */
public class ButtonCellEditor extends DefaultCellEditor {
    protected JButton button;

    private String label;

    private boolean isPushed;

    private int row = -1;

    private BlueLiveTopComponent dialog;

    public ButtonCellEditor(BlueLiveTopComponent dialog) {
        super(new JCheckBox());
        this.dialog = dialog;
        button = new JButton();
        button.setOpaque(true);
        button.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {
                fireEditingStopped();
            }
        });
        button.setText("Trigger");
    }

    public Component getTableCellEditorComponent(JTable table, Object value,
            boolean isSelected, int row, int column) {
        // if (isSelected) {
        // button.setForeground(table.getSelectionForeground());
        // button.setBackground(table.getSelectionBackground());
        // } else{
        // button.setForeground(table.getForeground());
        // button.setBackground(table.getBackground());
        // }
        this.row = row;
        isPushed = true;
        return button;
    }

    public Object getCellEditorValue() {
        if (isPushed) {
            //
            //
            dialog.triggerLiveObject(row);
            // JOptionPane.showMessageDialog(button ,row + " : Ouch!");
            // System.out.println(label + ": Ouch!");
        }
        isPushed = false;
        return null;
    }

    public boolean stopCellEditing() {
        isPushed = false;
        return super.stopCellEditing();
    }

    protected void fireEditingStopped() {
        super.fireEditingStopped();
    }
}
