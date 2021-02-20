/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2016 Steven Yi (stevenyi@gmail.com)
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

import blue.orchestra.blueSynthBuilder.BSBValue;
import blue.orchestra.editor.blueSynthBuilder.EditModeOnly;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Graphics;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javax.swing.JLabel;

/**
 * @author steven
 */
public class BSBValueView extends BSBObjectView<BSBValue> implements EditModeOnly,
        ChangeListener<String> {

    JLabel displayLabel;

    /**
     * @param knob
     */
    public BSBValueView(BSBValue value) {
        super(value);

        this.setLayout(new BorderLayout());

        displayLabel = new JLabel() {
            Color bgColor = new Color(255, 255, 255, 64);

            @Override
            protected void paintComponent(Graphics g) {
                g.setColor(bgColor);
                g.fillRect(0, 0, getWidth(), getHeight());
                super.paintComponent(g);
            }

        };
        this.add(displayLabel, BorderLayout.CENTER);

        displayLabel.setOpaque(false);
    }

    @Override
    public void addNotify() {
        super.addNotify();

        updateLabel();

        bsbObj.objectNameProperty().addListener(this);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        bsbObj.objectNameProperty().removeListener(this);
    }

    public void updateLabel() {
        displayLabel.setText("Value: <" + bsbObj.getObjectName() + ">");
        this.setPreferredSize(displayLabel.getPreferredSize());
        this.setSize(displayLabel.getPreferredSize());
        revalidate();
    }

    @Override
    public void changed(ObservableValue<? extends String> ov, String t, String t1) {
        updateLabel();
    }
}
