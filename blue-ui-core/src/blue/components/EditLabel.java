/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.components;

import java.awt.CardLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JTextField;

/**
 * @author Steven Yi
 */
public class EditLabel extends JComponent {
    JLabel valueDisplay = new JLabel();

    JTextField valueField = new JTextField();

    CardLayout cards = new CardLayout();

    Editable valueObject = null;

    public EditLabel() {

        valueDisplay.addMouseListener(new MouseAdapter() {
            public void mousePressed(MouseEvent e) {
                if (e.getClickCount() >= 2) {
                    editField();
                }
            }
        });

        valueField.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                setValueFromField();

            }

        });

        valueField.addFocusListener(new FocusAdapter() {

            public void focusLost(FocusEvent e) {
                showDisplay();
            }

        });

        this.setLayout(cards);
        this.add(valueDisplay, "display");
        this.add(valueField, "edit");
        cards.show(this, "display");

    }

    private void showDisplay() {
        cards.show(this, "display");
    }

    public void setEditable(Editable valueObj) {
        this.valueObject = valueObj;

    }

    protected void editField() {

        valueField.setText(valueObject.getValue());
        cards.show(this, "edit");

        valueField.requestFocus();
    }

    protected void setValueFromField() {
        String val = valueField.getText();

        if (valueObject.isValidValue(val)) {
            valueObject.setValue(val);
            valueDisplay.setText(val);
        }

        cards.show(this, "display");
    }

    public static void main(String[] args) {
    }
}
