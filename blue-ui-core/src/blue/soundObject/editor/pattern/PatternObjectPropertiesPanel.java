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
package blue.soundObject.editor.pattern;

import java.awt.Dimension;

import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

import blue.gui.LabelledItemPanel;
import blue.soundObject.PatternObject;

public class PatternObjectPropertiesPanel extends JComponent {

    SpinnerNumberModel intModel = new SpinnerNumberModel(1, 1,
            Integer.MAX_VALUE, 1);

    SpinnerNumberModel intModel2 = new SpinnerNumberModel(1, 1,
            Integer.MAX_VALUE, 1);

    JSpinner beatsSpinner = new JSpinner(intModel);

    JSpinner subDivisionsSpinner = new JSpinner(intModel2);

    private PatternObject patternObj = null;

    private boolean isUpdating = false;

    public PatternObjectPropertiesPanel() {
        this.setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        this.setPreferredSize(new Dimension(150, 200));

        LabelledItemPanel timePropsPanel = new LabelledItemPanel();
        timePropsPanel.setBorder(BorderFactory
                .createTitledBorder("Time Properties")); // TODO - TRANSLATE
        timePropsPanel.addItem("Beats", beatsSpinner);
        timePropsPanel.addItem("Subdivisions", subDivisionsSpinner);

        this.add(timePropsPanel);

        ChangeListener cl = new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                updateProperties();
            }
        };

        beatsSpinner.addChangeListener(cl);
        subDivisionsSpinner.addChangeListener(cl);
    }

    protected void updateProperties() {
        if (this.patternObj == null || isUpdating) {
            return;
        }

        int beats = ((Integer) beatsSpinner.getValue()).intValue();
        int subDivisions = ((Integer) subDivisionsSpinner.getValue())
                .intValue();

        this.patternObj.setTime(beats, subDivisions);
    }

    public void setPatternObject(PatternObject p) {
        this.isUpdating = true;

        this.patternObj = p;
        beatsSpinner.setValue(new Integer(p.getBeats()));
        subDivisionsSpinner.setValue(new Integer(p.getSubDivisions()));

        this.isUpdating = false;
    }
}
