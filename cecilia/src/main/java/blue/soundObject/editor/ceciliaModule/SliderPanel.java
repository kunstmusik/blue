/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

import blue.soundObject.CeciliaModule;
import blue.soundObject.ceciliaModule.CSlider;
import blue.soundObject.ceciliaModule.CeciliaObject;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.HashMap;
import java.util.Iterator;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public class SliderPanel extends JComponent implements ChangeListener,
        ActionListener {

    private HashMap labelMap = new HashMap();

    private HashMap sliderMap = new HashMap();

    private HashMap displayLabelMap = new HashMap();

    private HashMap dataValues = new HashMap();

    private int row = 0;

    private boolean updating = false;

    public SliderPanel() {
        setLayout(new GridBagLayout());
        addSpacerObject();
    }

    /**
     * 
     */
    private void addSpacerObject() {
        GridBagConstraints constraints = new GridBagConstraints();
        constraints.gridx = 0;
        constraints.gridy = 99;
        constraints.gridwidth = 3;
        constraints.insets = new Insets(10, 0, 0, 0);
        constraints.weighty = 1.0;
        constraints.fill = GridBagConstraints.BOTH;

        JLabel verticalFillLabel = new JLabel();

        add(verticalFillLabel, constraints);
    }

    public void clearSliders() {
        this.removeAll();

        labelMap.clear();
        sliderMap.clear();
        displayLabelMap.clear();
        dataValues.clear();

        row = 0;
        addSpacerObject();
    }

    public void addSlider(String name) {
        /*
         * LabelledRangeBar slider = new LabelledRangeBar(name, -100, 100);
         * slider.addChangeListener(this);
         */

        JLabel label = new JLabel(name);

        GridBagConstraints labelConstraints = new GridBagConstraints();

        labelConstraints.gridx = 0;
        labelConstraints.gridy = row;
        labelConstraints.insets = new Insets(10, 10, 0, 0);
        labelConstraints.anchor = GridBagConstraints.NORTHEAST;
        labelConstraints.fill = GridBagConstraints.NONE;

        add(label, labelConstraints);

        // Add the component with its constraints

        FloatSlider slider = new FloatSlider();
        slider.addChangeListener(this);
        slider.addActionListener(this);
        slider.setName(name);

        GridBagConstraints itemConstraints = new GridBagConstraints();

        itemConstraints.gridx = 1;
        itemConstraints.gridy = row;
        itemConstraints.insets = new Insets(10, 10, 0, 10);
        itemConstraints.weightx = 1.0;
        itemConstraints.anchor = GridBagConstraints.WEST;
        itemConstraints.fill = GridBagConstraints.HORIZONTAL;

        add(slider, itemConstraints);

        // Add display label

        DisplayLabel displayLabel = new DisplayLabel();

        GridBagConstraints displayLabelConstraints = new GridBagConstraints();

        displayLabelConstraints.gridx = 2;
        displayLabelConstraints.gridy = row;
        displayLabelConstraints.insets = new Insets(10, 0, 0, 10);
        displayLabelConstraints.weightx = 0.0;
        displayLabelConstraints.anchor = GridBagConstraints.NORTHWEST;
        displayLabelConstraints.fill = GridBagConstraints.NONE;

        add(displayLabel, displayLabelConstraints);

        row++;

        labelMap.put(name, label);
        sliderMap.put(name, slider);
        displayLabelMap.put(name, displayLabel);

    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.event.ChangeListener#stateChanged(javax.swing.event.ChangeEvent)
     */
    @Override
    public void stateChanged(ChangeEvent e) {
        if (!updating) {
            FloatSlider fSlider = (FloatSlider) e.getSource();

            String name = fSlider.getName();

            CSlider slider = (CSlider) dataValues.get(name);
            DisplayLabel label = (DisplayLabel) displayLabelMap.get(name);

            if (slider != null) {
                float newValue = fSlider.getValueFromRange();

                float truncatedValue = newValue
                        - (newValue % slider.getResolution());

                // System.out.println(newValue + " : " + truncatedValue);

                slider.setValue(truncatedValue);
                label.setText(Float.toString(truncatedValue));
            }
        }
    }

    /**
     * @param ceciliaModule
     */
    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        updating = true;
        HashMap map = ceciliaModule.getStateData();

        if (map.size() == 0) {
            return;
        }

        for (Iterator iter = map.values().iterator(); iter.hasNext();) {
            CeciliaObject element = (CeciliaObject) iter.next();

            if (element instanceof CSlider) {
                CSlider slider = (CSlider) element;
                setupCslider(slider);
            }
        }
        updating = false;
    }

    private void setupCslider(CSlider slider) {
        // ObjectUtilities.printMembers(slider);

        JLabel label = (JLabel) labelMap.get(slider.getObjectName());
        label.setText(slider.getLabel());

        DisplayLabel displayLabel = (DisplayLabel) displayLabelMap.get(slider
                .getObjectName());
        displayLabel.setUnit(slider.getUnit());

        FloatSlider fSlider = (FloatSlider) sliderMap.get(slider
                .getObjectName());

        float max = slider.getMax();
        float min = slider.getMin();

        fSlider.setRangeMax(max);
        fSlider.setRangeMin(min);
        fSlider.setResolution(slider.getResolution());

        float val = (slider.getValue() - min) / (max - min);

        fSlider.setValue(val);

        dataValues.put(slider.getObjectName(), slider);

        displayLabel.setText(Float.toString(slider.getValue()));
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        FloatSlider fSlider = (FloatSlider) e.getSource();

        String name = fSlider.getName();

        CSlider slider = (CSlider) dataValues.get(name);
        DisplayLabel label = (DisplayLabel) displayLabelMap.get(name);

        String command = e.getActionCommand();

        if (slider != null) {

            float val = slider.getValue();

            // float truncatedValue = val - (val % slider.getResolution());

            if (command.equals("nudgeLeft")) {
                val -= slider.getResolution();
            } else if (command.equals("nudgeRight")) {
                val += slider.getResolution();
            }

            slider.setValue(val);
            label.setText(Float.toString(val));

            float max = slider.getMax();
            float min = slider.getMin();

            float sliderVal = (val - min) / (max - min);

            fSlider.setValue(sliderVal);

        }

    }
}
