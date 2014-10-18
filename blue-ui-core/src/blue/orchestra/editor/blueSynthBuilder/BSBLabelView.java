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
package blue.orchestra.editor.blueSynthBuilder;

import java.awt.BorderLayout;

import javax.swing.JLabel;

import blue.orchestra.blueSynthBuilder.BSBLabel;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class BSBLabelView extends BSBObjectView {

    private BSBLabel label;

    private JLabel jlabel = new JLabel();

    public BSBLabelView(BSBLabel label) {
        this.label = label;
        super.setBSBObject(this.label);

        this.setLayout(new BorderLayout());
        this.add(jlabel, BorderLayout.CENTER);

        jlabel.setText(label.getLabel());

        this.setSize(jlabel.getPreferredSize());

        repaint();
    }

    public String getLabel() {
        return label.getLabel();
    }

    public void setLabel(String label) {
        this.label.setLabel(label);
        jlabel.setText(label);
        this.setSize(jlabel.getPreferredSize());
        repaint();
    }

    /*
     * public void paintComponent(Graphics g) { Rectangle2D rect =
     * g.getFontMetrics().getStringBounds(label.getLabel(), g);
     * 
     * this.setSize((int)rect.getWidth() + 6, (int)rect.getHeight() + 6);
     * g.setColor(UIManager.getColor("Label.foreground"));
     * g.drawString(label.getLabel(), 3,15); }
     */

    public void cleanup() {}
}
