/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
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
package blue.components;

import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.BevelBorder;
import javax.swing.border.EmptyBorder;

public class LabelledPanel extends JComponent {

    ArrayList<ActionListener> listeners = new ArrayList<ActionListener>();

    JComponent dockItem = null;

    JLabel label;

    public LabelledPanel() {
        this("", null);
    }

    public LabelledPanel(String name, JComponent dockItem) {
        this.setLayout(new BorderLayout());

        label = new JLabel(name);
        label.setBorder(BorderFactory.createCompoundBorder(BorderFactory
                .createBevelBorder(BevelBorder.RAISED), new EmptyBorder(3, 3,
                3, 3)));

        // this.setBorder(BorderFactory.createBevelBorder(BevelBorder.LOWERED));

        this.add(label, BorderLayout.NORTH);

        if (this.dockItem != null) {
            this.remove(dockItem);
        }

        this.dockItem = dockItem;

        if (dockItem != null) {

            this.add(dockItem, BorderLayout.CENTER);
        }

        label.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {
                if (e.getClickCount() >= 2) {
                    fireActionPerformed();
                }
            }

        });
    }

    @Override
    public void setName(String name) {
        label.setText(name);
    }

    @Override
    public String getName() {
        return label.getText();
    }

    public void addActionListener(ActionListener al) {
        listeners.add(al);
    }

    public void removeActionListener(ActionListener al) {
        listeners.remove(al);
    }

    public void fireActionPerformed() {
        ActionEvent ae = new ActionEvent(this, ActionEvent.ACTION_PERFORMED,
                "clicked");
        for (ActionListener listener : listeners) {
            listener.actionPerformed(ae);
        }
    }

    public static void main(String args[]) {

        LabelledPanel panel = new LabelledPanel("Test Panel", new JPanel());
        GUI.showComponentAsStandalone(panel, "Title Bar Panel Test", true);

    }
}