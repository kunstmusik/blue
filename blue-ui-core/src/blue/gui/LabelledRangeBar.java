package blue.gui;

import java.awt.BorderLayout;
import java.awt.Dimension;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class LabelledRangeBar extends JComponent {
    JLabel label = new JLabel();

    JSlider slider = new JSlider(JSlider.HORIZONTAL);

    JLabel display = new JLabel();

    LabelledRangeLabelFilter filter;

    public LabelledRangeBar(String labelText, int rangeStart, int rangeEnd) {
        this.setLayout(new BorderLayout());

        label.setText(labelText);
        label.setVerticalAlignment(JLabel.TOP);

        slider.setMinimum(rangeStart);
        slider.setMaximum(rangeEnd);
        slider.setValue(rangeEnd);

        slider.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                if (filter != null) {
                    display.setText(filter.filter(slider.getValue()));
                } else {
                    display.setText(Integer.toString(slider.getValue()));
                }
            }
        });

        slider.setValue(0);

        display.setPreferredSize(new Dimension(50, 27));
        display.setVerticalAlignment(JLabel.TOP);

        this.add(label, BorderLayout.WEST);
        this.add(slider, BorderLayout.CENTER);
        this.add(display, BorderLayout.EAST);

        this.setBorder(BorderFactory.createEmptyBorder(3, 0, 3, 0));
    }

    public void addChangeListener(ChangeListener cListener) {
        slider.addChangeListener(cListener);
    }

    public int getValue() {
        return slider.getValue();
    }

    public void setValue(int val) {
        slider.setValue(val);
    }

    public void setFilter(LabelledRangeLabelFilter filter) {
        this.filter = filter;
    }

    public static void main(String[] args) {
        LabelledRangeBar labelledRangeBar1 = new LabelledRangeBar("Test: ", 0,
                127);

        blue.utility.GUI.showComponentAsStandalone(labelledRangeBar1,
                "Labelled Range Bar Test", true);
    }
}