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

package blue.orchestra.editor.blueSynthBuilder;

import blue.BlueSystem;
import blue.utility.GUI;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.ArrayList;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComponent;
import org.openide.util.ImageUtilities;

/**
 * @author Steven Yi
 */
public class AlignmentPanel extends JComponent implements ActionListener {

    String[] alignOptions = { "Left", "Horizontal Center", "Right", "Top",
            "Vertical Center", "Bottom" };

    String[] commandNames = null;

    private ArrayList<JComponent> jCompList;

    ArrayList<JButton> buttons = new ArrayList<>();

    public AlignmentPanel() {
        initCommandNames();

        this.setLayout(new GridLayout(2, 1));

        Box alignButtons = new Box(BoxLayout.X_AXIS);
        Box distributeButtons = new Box(BoxLayout.X_AXIS);

        alignButtons.setBorder(BorderFactory.createTitledBorder(BlueSystem
                .getString("instrument.bsb.align")));
        distributeButtons.setBorder(BorderFactory.createTitledBorder(BlueSystem
                .getString("instrument.bsb.distribute")));

        for (int i = 0; i < alignOptions.length; i++) {
            JButton b = createButton(commandNames[i]);

            ImageIcon icon = createImageIcon(i);

            b.setIcon(icon);

            alignButtons.add(b);
        }

        for (int i = 0; i < alignOptions.length; i++) {
            JButton b = createButton(commandNames[i + 6]);

            ImageIcon icon = createImageIcon(i);

            b.setIcon(icon);

            distributeButtons.add(b);
        }

        this.add(alignButtons);
        this.add(distributeButtons);
    }

    private void initCommandNames() {
        commandNames = new String[12];

        commandNames[0] = BlueSystem.getString("instrument.bsb.align.left");
        commandNames[1] = BlueSystem.getString("instrument.bsb.align.hcenter");
        commandNames[2] = BlueSystem.getString("instrument.bsb.align.right");
        commandNames[3] = BlueSystem.getString("instrument.bsb.align.top");
        commandNames[4] = BlueSystem.getString("instrument.bsb.align.vcenter");
        commandNames[5] = BlueSystem.getString("instrument.bsb.align.bottom");

        commandNames[6] = BlueSystem
                .getString("instrument.bsb.distribute.left");
        commandNames[7] = BlueSystem
                .getString("instrument.bsb.distribute.hcenter");
        commandNames[8] = BlueSystem
                .getString("instrument.bsb.distribute.right");
        commandNames[9] = BlueSystem.getString("instrument.bsb.distribute.top");
        commandNames[10] = BlueSystem
                .getString("instrument.bsb.distribute.vcenter");
        commandNames[11] = BlueSystem
                .getString("instrument.bsb.distribute.bottom");
    }

    /**
     * @param i
     * @return
     */
    private ImageIcon createImageIcon(int i) {
        ImageIcon icon = null;


        // TODO - fix Alignment Panel
        if (i == 1 || i == 4) {
            icon = new ImageIcon(ImageUtilities.loadImage("blue/resources/images/AlignCenter16.gif"));

        } else {
            String imageName = "Align" + alignOptions[i] + "16.gif";
            icon = new ImageIcon(ImageUtilities.loadImage("blue/resources/images/" + imageName));
        }
        return icon;
    }

    public void setJComponentArrayList(ArrayList<JComponent> jCompList) {
        this.jCompList = jCompList;
    }

    private JButton createButton(String type) {
        JButton button = new JButton();

        button.setPreferredSize(new Dimension(24, 24));
        button.setActionCommand(type);
        button.addActionListener(this);
        button.setToolTipText(type);

        button.setFocusPainted(false);

        button.setBorderPainted(false);

        buttons.add(button);

        return button;
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.awt.event.ActionListener#actionPerformed(java.awt.event.ActionEvent)
     */
    @Override
    public void actionPerformed(ActionEvent e) {
        if (jCompList != null && jCompList.size() > 1) {
            String command = e.getActionCommand();

            for (int i = 0; i < 6; i++) {
                if (command.equals(commandNames[i])) {
                    GUI.align(jCompList, i);
                }
            }

            if (jCompList.size() > 2) {
                for (int i = 0; i < 6; i++) {
                    if (command.equals(commandNames[i + 6])) {
                        GUI.distribute(jCompList, i);
                    }
                }
            }
        }
    }

}