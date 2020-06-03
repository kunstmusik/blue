/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@csounds.com)
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

import java.awt.Color;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JColorChooser;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;

/**
 * @author steven
 */
public class ColorSelectionPanel extends JPanel {
    private Color color = Color.BLACK;

    public ColorSelectionPanel() {
        this.setBackground(color);

        this.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                if (!isEnabled()) {
                    return;
                }

                if (SwingUtilities.isLeftMouseButton(e)) {
                    chooseColor();
                }
            }

        });
    }

    private void chooseColor() {
        Color retVal = JColorChooser.showDialog(SwingUtilities.getRoot(this),
                "Choose Color", color);

        if (retVal != null) {
            Color oldVal = color;

            setColor(retVal);
            firePropertyChange("colorSelectionValue", oldVal, retVal);
        }

    }

    /**
     * @return Returns the color.
     */
    public Color getColor() {
        return color;
    }

    /**
     * @param color
     *            The color to set.
     */
    public void setColor(Color color) {
        Object oldVal = this.color;

        this.color = color;

        this.setBackground(color);

    }

    public static void main(String[] args) {
        PropertyChangeListener pcl = (PropertyChangeEvent evt) -> {
            System.out.println(evt.getPropertyName() + " : "
                    + evt.getOldValue() + " : " + evt.getNewValue());
        };

        ColorSelectionPanel csp = new ColorSelectionPanel();
        csp.addPropertyChangeListener(pcl);

        blue.utility.GUI.showComponentAsStandalone(csp, "Color Selction Panel",
                true);
    }

}