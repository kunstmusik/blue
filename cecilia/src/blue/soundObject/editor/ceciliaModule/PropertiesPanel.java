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

package blue.soundObject.editor.ceciliaModule;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.BoxLayout;
import javax.swing.ButtonGroup;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JRadioButton;

import pnuts.awt.PnutsLayout;
import blue.soundObject.CeciliaModule;

public class PropertiesPanel extends JComponent {
    private CeciliaModule ceciliaModule;

    JRadioButton mono = new JRadioButton("Mono");

    JRadioButton stereo = new JRadioButton("Stereo");

    JRadioButton quad = new JRadioButton("Quad");

    JRadioButton[] orchOptions = { mono, stereo, quad };

    Object[] genSizes = { "128", "256", "512", "1024", "2048", "4096", "8192",
            "16384", "32768", "65536" };

    JComboBox genSizeOptions = new JComboBox(genSizes);

    boolean initiatingObject = false;

    public PropertiesPanel() {
        ButtonGroup group = new ButtonGroup();

        ActionListener orchListener = new ActionListener() {
            public void actionPerformed(ActionEvent e) {
                if (initiatingObject) {
                    return;
                }
                for (int i = 0; i < orchOptions.length; i++) {
                    if (orchOptions[i].isSelected()) {
                        ceciliaModule.setOrchestraVersion(i);
                    }
                }
            }
        };

        mono.addActionListener(orchListener);
        stereo.addActionListener(orchListener);
        quad.addActionListener(orchListener);

        genSizeOptions.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {
                if (initiatingObject) {
                    return;
                }
                ceciliaModule.setGenSize(genSizeOptions.getSelectedItem()
                        .toString());
            }
        });

        group.add(mono);
        group.add(stereo);
        group.add(quad);

        JPanel buttonPanel = new JPanel();
        buttonPanel.setLayout(new BoxLayout(buttonPanel, BoxLayout.Y_AXIS));
        buttonPanel.add(mono);
        buttonPanel.add(stereo);
        buttonPanel.add(quad);

        buttonPanel.add(genSizeOptions);

        stereo.setSelected(true);

        // this.setLayout(new BorderLayout());
        this.setLayout(new PnutsLayout("cols=3"));
        this.add(buttonPanel, "valign=top");

    }

    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        this.initiatingObject = true;

        this.ceciliaModule = ceciliaModule;
        orchOptions[ceciliaModule.getOrchestraVersion()].setSelected(true);
        genSizeOptions.setSelectedItem(ceciliaModule.getGenSize());

        this.initiatingObject = false;
    }
}
