/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JSplitPane;
import javax.swing.JTextArea;

/**
 * @author steven
 */

public class DockingSplitPane extends JComponent {
    private final DockWindow window = new DockWindow();

    private final JSplitPane jsp = new JSplitPane();

    public DockingSplitPane(final JComponent primary, String dockItemName,
            JComponent dockableItem) {
        final LabelledPanel dockPanel = new LabelledPanel(dockItemName,
                dockableItem);

        this.setLayout(new BorderLayout());

        this.add(jsp, BorderLayout.CENTER);

        jsp.add(primary, JSplitPane.LEFT);
        jsp.add(dockPanel, JSplitPane.RIGHT);

        dockPanel.addActionListener((ActionEvent e) -> {
            if (window.isShowing()) {
                window.remove(dockPanel);
                window.setVisible(false);
                remove(primary);
                add(jsp);
                jsp.add(primary, JSplitPane.LEFT);
                jsp.add(dockPanel, JSplitPane.RIGHT);
                revalidate();
                repaint();
            } else {
                removeAll();
                add(primary);
                
                window.setSize(dockPanel.getSize());
                window.add(dockPanel);
                window.setVisible(true);
                
                revalidate();
                repaint();
            }
        });
    }

    public static void main(String[] args) {
        DockingSplitPane dsp = new DockingSplitPane(new JTextArea(), "Test",
                new JTextArea());
        GUI.showComponentAsStandalone(dsp, "Docking Test", true);
    }

    static class DockWindow extends JDialog {
        public DockWindow() {

        }

    }

}