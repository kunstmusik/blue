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

import blue.components.lines.LineBoundaryDialog;
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.orchestra.blueSynthBuilder.BSBVSliderBank;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.JOptionPane;

public class BSBVSliderBankView extends AutomatableBSBObjectView {

    private static final int VALUE_DISPLAY_HEIGHT = 30;

    private static final int VALUE_DISPLAY_WIDTH = 50;

    private final BSBVSliderBank sliderBank;

    /**
     * @param slider
     */
    public BSBVSliderBankView(BSBVSliderBank sliderBank) {
        this.sliderBank = sliderBank;
        super.setBSBObject(this.sliderBank);

        this.setLayout(new VSliderBankLayout());

        resetSlidersUI();

    }

    private void resetSlidersUI() {

        for(Component c : getComponents()) {
            ((BSBVSliderView)c).cleanup();
        }

        this.removeAll();

        if (sliderBank == null) {
            return;
        }

        ArrayList sliders = sliderBank.getSliders();

        for (Iterator iter = sliders.iterator(); iter.hasNext();) {
            BSBVSlider vSlider = (BSBVSlider) iter.next();
            this.add(new BSBVSliderView(vSlider));

        }

        int size = sliders.size();
        int w = (size * VALUE_DISPLAY_WIDTH)
                + (sliderBank.getGap() * (size - 1));

        Dimension d = new Dimension(w, sliderBank.getSliderHeight() + 30);

        this.setSize(d);
        this.setPreferredSize(d);

        this.revalidate();

    }

    public int getNumberOfSliders() {
        return sliderBank.getNumberOfSliders();
    }

    public void setNumberOfSliders(int numSliders) {
        if (numSliders > sliderBank.getNumberOfSliders()
                && !sliderBank.willBeUnique(numSliders)) {
            JOptionPane
                    .showMessageDialog(
                            this,
                            "Can not set the new number of "
                                    + "sliders as a replacement key clash was detected.",
                            "Error: Replacement Key Clash",
                            JOptionPane.ERROR_MESSAGE);
            return;
        }

        if (numSliders != sliderBank.getNumberOfSliders() && numSliders > 0) {
            sliderBank.setNumberOfSliders(numSliders);
            resetSlidersUI();
        }
    }

    public void setMinimum(float minimum) {
        if (minimum >= sliderBank.getMaximum()) {
            JOptionPane.showMessageDialog(null, "Error: Min value "
                    + "can not be set greater or equals to Max value.",
                    "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        String retVal = LineBoundaryDialog.getLinePointMethod();

        if (retVal == null) {
            return;
        }

        boolean truncate = (retVal == LineBoundaryDialog.TRUNCATE);
        sliderBank.setMinimum(minimum, truncate);

        for (int i = 0; i < getComponentCount(); i++) {
            BSBVSliderView view = (BSBVSliderView) getComponent(i);
            view.setMinimum(minimum, truncate);
        }
    }

    public float getMinimum() {
        return sliderBank.getMinimum();
    }

    public float getMaximum() {
        return sliderBank.getMaximum();
    }

    public void setMaximum(float maximum) {
        if (maximum <= sliderBank.getMinimum()) {
            JOptionPane.showMessageDialog(null, "Error: Max value "
                    + "can not be set less than or " + "equal to Min value.",
                    "Error", JOptionPane.ERROR_MESSAGE);

            return;
        }

        String retVal = LineBoundaryDialog.getLinePointMethod();

        if (retVal == null) {
            return;
        }

        boolean truncate = (retVal == LineBoundaryDialog.TRUNCATE);
        sliderBank.setMaximum(maximum, truncate);

        for (int i = 0; i < getComponentCount(); i++) {
            BSBVSliderView view = (BSBVSliderView) getComponent(i);
            view.setMaximum(maximum, truncate);
        }
    }

    public float getResolution() {
        return sliderBank.getResolution();
    }

    public void setResolution(float resolution) {
        sliderBank.setResolution(resolution);

        for (int i = 0; i < getComponentCount(); i++) {
            BSBVSliderView view = (BSBVSliderView) getComponent(i);
            view.setResolution(resolution);
        }
    }

    public int getSliderHeight() {
        return sliderBank.getSliderHeight();
    }

    public void setSliderHeight(int sliderHeight) {
        sliderBank.setSliderHeight(sliderHeight);

        int size = sliderBank.getSliders().size();
        int w = (size * VALUE_DISPLAY_WIDTH)
                + (sliderBank.getGap() * (size - 1));

        Dimension d = new Dimension(w, sliderBank.getSliderHeight() + 30);

        this.setSize(d);
        this.setPreferredSize(d);

        for (int i = 0; i < getComponentCount(); i++) {
            BSBVSliderView view = (BSBVSliderView) getComponent(i);
            view.setSliderHeight(sliderHeight);
        }

        revalidate();
    }

    public int getGap() {
        return sliderBank.getGap();
    }

    public void setGap(int gap) {
        sliderBank.setGap(gap);

        int size = sliderBank.getSliders().size();
        int w = (size * VALUE_DISPLAY_WIDTH)
                + (sliderBank.getGap() * (size - 1));

        Dimension d = new Dimension(w, sliderBank.getSliderHeight() + 30);

        this.setSize(d);
        this.setPreferredSize(d);

        revalidate();
    }

    public boolean isRandomizable() {
        return sliderBank.isRandomizable();
    }

    public void setRandomizable(boolean randomizable) {
        sliderBank.setRandomizable(randomizable);
    }

    @Override
    public void cleanup() {
        for(Component c : getComponents()) {
            ((BSBVSliderView)c).cleanup();
        }

        this.removeAll();
    }

    class VSliderBankLayout implements LayoutManager {

        public VSliderBankLayout() {
        }

        @Override
        public void addLayoutComponent(String name, Component comp) {
        }

        @Override
        public void removeLayoutComponent(Component comp) {
        }

        @Override
        public Dimension preferredLayoutSize(Container parent) {
            return minimumLayoutSize(parent);
        }

        @Override
        public Dimension minimumLayoutSize(Container parent) {
            int count = parent.getComponentCount();
            if (count == 0) {
                return new Dimension(0, 0);
            }

            if (parent.getParent() == null) {
                return new Dimension(0, 0);
            }

            Component c = parent.getComponent(0);

            Dimension size = c.getPreferredSize();

            int widthAdjustment = 0;
            int h = size.height;

            if (sliderBank != null) {
                widthAdjustment = sliderBank.getGap();
                h = sliderBank.getSliderHeight();
            }

            int w = (count * size.width) + widthAdjustment;

            return new Dimension(w, h);
        }

        @Override
        public void layoutContainer(Container parent) {
            int count = parent.getComponentCount();
            if (count == 0) {
                return;
            }

            if (parent.getParent() == null) {
                return;
            }

            int gap = 0;
            int h = 0;

            if (sliderBank != null) {
                gap = sliderBank.getGap();
                h = sliderBank.getSliderHeight() + 30;
            }

            for (int i = 0; i < count; i++) {
                Component temp = parent.getComponent(i);

                int w = (VALUE_DISPLAY_WIDTH * i) + (gap * i);

                temp.setLocation(w, 0);
                temp.setSize(VALUE_DISPLAY_WIDTH, h);
            }
        }

    }
}