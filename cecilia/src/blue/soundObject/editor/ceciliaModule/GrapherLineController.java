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

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.Box;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JLabel;

import org.wonderly.awt.Packer;

import blue.soundObject.CeciliaModule;
import blue.utility.TextUtilities;

/**
 * Contains line info panel and display controller
 */
public class GrapherLineController extends JComponent implements ActionListener {

    private int index = 0;

    private int grapherIndex = 0;

    private Grapher grapher;

    private Packer packer;

    public GrapherLineController() {
        packer = new Packer(this);
    }

    public void addSeparator() {
        this.add(Box.createVerticalStrut(10));
    }

    public void addGrapher(String name, String label) {
        String buttonLabel = TextUtilities.replaceAll(label, "\\n", "<br>");
        buttonLabel = "<html>" + buttonLabel + "</html>";

        GraphLabelController controller = new GraphLabelController(name,
                buttonLabel, LineColors.getColor(this.index++));

        controller.addActionListener(this);

        packer.pack(controller).gridx(0).gridy(grapherIndex++).fillx().west();
    }

    public void clearPanel() {
        this.removeAll();

        packer.pack(new JLabel()).gridx(0).gridy(99).inset(
                new Insets(10, 0, 0, 0)).filly();

        this.index = 0;
        this.grapherIndex = 0;
    }

    public void actionPerformed(ActionEvent e) {
        Object obj = e.getSource();
        if (obj instanceof JCheckBox) {
            JCheckBox trigger = (JCheckBox) obj;
            System.err.println(trigger.getActionCommand() + " : "
                    + trigger.isSelected());
        } else if (obj instanceof JButton) {
            JButton button = (JButton) obj;
            if (this.grapher != null) {
                grapher.setCurrentGraph(button.getActionCommand());
            }
        }

    }

    /**
     * @param ceciliaModule
     */
    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        // TODO Auto-generated method stub

    }

    /**
     * @param grapher
     */
    public void setGrapher(Grapher grapher) {
        this.grapher = grapher;
    }
}

class GraphLabelController extends JComponent {

    JButton button = new JButton();

    JCheckBox checkBox = new JCheckBox();

    Color color;

    public GraphLabelController(String graphObjectName, String label,
            Color color) {
        this.setLayout(new BorderLayout());
        this.add(button, BorderLayout.CENTER);
        this.add(checkBox, BorderLayout.EAST);
        this.color = color;

        checkBox.setSelected(true);
        checkBox.setActionCommand(graphObjectName);

        button.setText(label);
        button.setActionCommand(graphObjectName);
        checkBox.setBackground(color);
    }

    /**
     * @param controller
     */
    public void addActionListener(ActionListener listener) {
        this.button.addActionListener(listener);
        this.checkBox.addActionListener(listener);
    }
}