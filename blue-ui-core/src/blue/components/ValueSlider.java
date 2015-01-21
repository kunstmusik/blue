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

/**
 * Based on ValueSlider by Alex DeCastro
 * 
 * Modified by Steven Yi
 */

package blue.components;

import javax.swing.BorderFactory;
import javax.swing.JFrame;
import javax.swing.JSlider;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public class ValueSlider extends JSlider {

    private float min, max;

    private int resolution;

    // ----------------------------------------------------------------------
    // Constructors
    // ----------------------------------------------------------------------

    /**
     * Creates a new ValueSlider.
     */
    public ValueSlider() {
        initialize(100);
    }

    /**
     * Creates a new ValueSlider.
     * 
     * @param resolution
     *            the tick resolution
     */
    public ValueSlider(int resolution) {
        initialize(resolution);
    }

    // ----------------------------------------------------------------------
    // Methods
    // ----------------------------------------------------------------------

    /**
     * Initialize.
     * 
     * @param resolution
     *            the tick resolution
     */
    private void initialize(int resolution) {
        this.resolution = resolution;

        super.setMinimum(0);
        super.setMaximum(resolution);
        setBorder(null);
        setOrientation(HORIZONTAL);
        setMajorTickSpacing(10);
        setMinorTickSpacing(1);
        setPaintTicks(false);
        setPaintLabels(false);
        setBorder(BorderFactory.createEmptyBorder(0, 0, 1, 0));
        setPreferredSize(new java.awt.Dimension(100, 16));
    }

    /**
     * Set the slider values.
     * 
     * @param min
     *            the min value
     * @param max
     *            the max value
     * @param value
     *            the value
     */
    public void set(float min, float max, float value) {
        this.min = min;
        this.max = max;
        setValue(value);
    }

    /**
     * Set the slider minimum as a float.
     * 
     * @param min
     *            the min value
     */
    public void setMinimum(float min) {
        this.min = min;
    }

    /**
     * Set the slider maximum as a float.
     * 
     * @param max
     *            the max value
     */
    public void setMaximum(float max) {
        this.max = max;
    }

    /**
     * Set the slider value as a float.
     * 
     * @param value
     *            the value
     */
    public void setValue(float value) {
        if (value < min) {
            value = min;
        }
        if (value > max) {
            value = max;
        }

        int ival = floatToInt(min, max, value, resolution);
        super.setValue(ival);
    }

    /**
     * Get the slider value as a float.
     * 
     * @return the value
     */
    public float getFloat() {
        float value = intToFloat(resolution, getValue(), min, max);
        return value;
    }

    /**
     * Set the slider resolution.
     * 
     * @param resolution
     *            the resolution
     */
    public void setResolution(int resolution) {
        this.resolution = resolution;
        super.setMaximum(resolution);
    }

    /**
     * Convenience method to convert float to int.
     */
    private int floatToInt(float min, float max, float val, int resolution) {

        float distance = max - min;
        int ival = (int) (((val - min) / distance) * resolution);
        return ival;
    }

    /**
     * Convenience method to convert int to float.
     */
    private float intToFloat(int resolution, int ival, float min, float max) {
        float distance = max - min;
        float val = (ival * distance / resolution) + min;

        return val;
    }

    // ----------------------------------------------------------------------
    // Unit test
    // ----------------------------------------------------------------------

    /**
     * Unit test.
     * 
     * @param argv
     *            the command line arguments
     */
    public static void main(String[] args) {
        System.out.println("----------------------------------------");
        System.out.println("TEST: ValueSlider: Starting...\n");

        final ValueSlider slider = new ValueSlider(10000);

        slider.set(0.0f, 80.0f, 40.0f);

        slider.addChangeListener(new ChangeListener() {

            @Override
            public void stateChanged(ChangeEvent e) {
                System.out.println(slider.getFloat());

            }

        });

        JFrame frame = new JFrame();
        frame.getContentPane().add(slider);
        frame.pack();
        frame.setLocation(10, 10);
        frame.setTitle("TEST: ValueSlider");
        frame.setVisible(true);

        // The application will exit when this frame is closed.
        frame.addWindowListener(new java.awt.event.WindowAdapter() {

            @Override
            public void windowClosing(java.awt.event.WindowEvent e) {
                System.exit(0);
            }
        });

        System.out.println("TEST: ValueSlider: Completed!");
        System.out.println("----------------------------------------");
    }
}
