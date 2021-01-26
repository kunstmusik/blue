/*
 * blue - object composition environment for csound
 * Copyright (c) 2012 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder.swing;

import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.*;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.SwingConstants;

/**
 * Panel that switches between a label and a text field for editing
 *
 * @author stevenyi
 */
public class ValuePanel extends JPanel {

    private static final Color BG_COLOR = new Color(20, 29, 45);

    JLabel valueDisplay = new JLabel("0.0");
    JTextField valueField = new JTextField();
    CardLayout cards = new CardLayout();

    private final static RenderingHints AALIAS;
    
    static {
        AALIAS = new RenderingHints(
            RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        AALIAS.put(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    }

    public ValuePanel() {
        valueDisplay.setHorizontalAlignment(SwingConstants.CENTER);

        valueField.setHorizontalAlignment(SwingConstants.CENTER);

        valueDisplay.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {
                if (e.getClickCount() >= 2) {
                    editField();
                }
            }
        });

        valueField.addActionListener((ActionEvent e) -> {
            setValueFromField();
        });

        valueField.addFocusListener(new FocusAdapter() {

            @Override
            public void focusLost(FocusEvent e) {
                cards.show(ValuePanel.this, "display");
            }
        });

        this.setLayout(cards);
        this.add(valueDisplay, "display");
        this.add(valueField, "edit");
        cards.show(this, "display");

        setOpaque(false);
    }

    public void setValue(String value) {
        valueDisplay.setText("<html>" + value + "</html>");
        valueField.setText(value);
        valueDisplay.setToolTipText(value);
    }

    public String getPendingValue() {
        return valueField.getText();
    }

    protected void editField() {
//        String strVal = valueDisplay.getText();

//        valueField.setText(strVal);
        cards.show(this, "edit");

        valueField.requestFocus();
        valueField.setCaretPosition(valueField.getText().length());
        valueField.moveCaretPosition(0);
    }

    protected void setValueFromField() {
        firePropertyChange("value", valueDisplay.getText(), valueField.getText());
        cards.show(this, "display");
    }

    @Override
    public void paintComponent(Graphics g) {
//        super.paintComponent(g);
//        if (getParent() != null) {
//            g.setColor(getParent().getBackground());
//        }
//        g.fillRect(0, 0, getWidth(), getHeight());

        Graphics2D g2d = (Graphics2D)g;
        g2d.setRenderingHints(AALIAS);
        g2d.setColor(BG_COLOR);
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 6, 6);
    }

}
