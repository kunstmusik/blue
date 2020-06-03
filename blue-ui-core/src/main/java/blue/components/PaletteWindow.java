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
package blue.components;

import blue.utility.GUI;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Insets;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JLayeredPane;
import javax.swing.UIManager;
import javax.swing.border.BevelBorder;

public class PaletteWindow extends JFrame {

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        JDialog.setDefaultLookAndFeelDecorated(true);

        JDialog dialog = new JDialog((Frame) null, "Test");

        dialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        dialog.getRootPane().setBorder(new BevelBorder(BevelBorder.RAISED));

        dialog.setSize(400, 300);
        dialog.setVisible(true);

        JDialog dialog2 = new JDialog((Frame) null);

        dialog2.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        JLayeredPane layeredPane = dialog2.getRootPane().getLayeredPane();

        Component[] comps = layeredPane
                .getComponentsInLayer(JLayeredPane.FRAME_CONTENT_LAYER
                        .intValue());

        for (int i = 0; i < comps.length; i++) {
            Component component = comps[i];

            if (component != dialog2.getContentPane()) {
                JComponent c = ((JComponent) component);
                c.setPreferredSize(new Dimension(12, 12));

                Component[] subComponents = c.getComponents();

                for (int j = 0; j < subComponents.length; j++) {
                    Component component2 = subComponents[j];

                    if (component2 instanceof JButton) {
                        JButton b = (JButton) component2;

                        b.setIcon(UIManager
                                .getIcon("InternalFrame.paletteCloseIcon"));

                        b.setPreferredSize(new Dimension(8, 8));
                        b.setMargin(new Insets(1, 1, 1, 1));
                    }

                }
            }
        }

        dialog2.getRootPane().setBorder(new BevelBorder(BevelBorder.RAISED));

        dialog2.setSize(400, 300);
        dialog2.setVisible(true);

        JDialog.setDefaultLookAndFeelDecorated(false);

        JDialog dialog3 = new JDialog((Frame) null, "Test3");

        dialog3.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        dialog3.setSize(400, 300);
        dialog3.setVisible(true);

    }
}
