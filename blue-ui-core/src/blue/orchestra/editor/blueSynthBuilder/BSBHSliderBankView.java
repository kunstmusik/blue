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
import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.orchestra.blueSynthBuilder.BSBHSliderBank;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;
import java.util.ArrayList;
import java.util.Iterator;
import javax.swing.JOptionPane;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class BSBHSliderBankView extends AutomatableBSBObjectView {

    private static final int VALUE_DISPLAY_HEIGHT = 30;

    private static final int VALUE_DISPLAY_WIDTH = 50;

    private final BSBHSliderBank sliderBank;

    /**
     * @param slider
     */
    public BSBHSliderBankView(BSBHSliderBank sliderBank) {
        this.sliderBank = sliderBank;
        super.setBSBObject(this.sliderBank);

        this.setLayout(new VSliderBankLayout());

        resetSlidersUI();

    }

    private void resetSlidersUI() {
        for(Component c : getComponents()) {
            ((BSBHSliderView)c).cleanup();
        }

        this.removeAll();
        
        if (sliderBank == null) {
            return;
        }

        ArrayList<BSBHSlider> sliders = sliderBank.getSliders();

        for (BSBHSlider vSlider : sliders) {
            this.add(new BSBHSliderView(vSlider));
        }

        int size = sliders.size();
        int w = sliderBank.getSliderWidth() + VALUE_DISPLAY_WIDTH;
        int h = (VALUE_DISPLAY_HEIGHT * size)
                + (sliderBank.getGap() * (size - 1));

        Dimension d = new Dimension(w, h);

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
            BSBHSliderView view = (BSBHSliderView) getComponent(i);
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
            BSBHSliderView view = (BSBHSliderView) getComponent(i);
            view.setMaximum(maximum, truncate);
        }
    }

    public float getResolution() {
        return sliderBank.getResolution();
    }

    public void setResolution(float resolution) {
        sliderBank.setResolution(resolution);

        for (int i = 0; i < getComponentCount(); i++) {
            BSBHSliderView view = (BSBHSliderView) getComponent(i);
            view.setResolution(resolution);
        }
    }

    public int getSliderWidth() {
        return sliderBank.getSliderWidth();
    }

    public void setSliderWidth(int sliderWidth) {
        sliderBank.setSliderWidth(sliderWidth);

        int size = sliderBank.getSliders().size();
        int w = sliderBank.getSliderWidth() + VALUE_DISPLAY_WIDTH;
        int h = (VALUE_DISPLAY_HEIGHT * size)
                + (sliderBank.getGap() * (size - 1));

        Dimension d = new Dimension(w, h);

        this.setSize(d);
        this.setPreferredSize(d);

        for (int i = 0; i < getComponentCount(); i++) {
            BSBHSliderView view = (BSBHSliderView) getComponent(i);
            view.setSliderWidth(sliderWidth);
        }

        revalidate();
    }

    public int getGap() {
        return sliderBank.getGap();
    }

    public void setGap(int gap) {
        sliderBank.setGap(gap);

        int size = sliderBank.getSliders().size();
        int w = sliderBank.getSliderWidth() + VALUE_DISPLAY_WIDTH;
        int h = (VALUE_DISPLAY_HEIGHT * size)
                + (sliderBank.getGap() * (size - 1));

        Dimension d = new Dimension(w, h);

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
            ((BSBHSliderView)c).cleanup();
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

            int w = sliderBank.getSliderWidth() + VALUE_DISPLAY_WIDTH;
            int h = (VALUE_DISPLAY_HEIGHT * count)
                    + (sliderBank.getGap() * (count - 1));

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
            int w = 0;

            if (sliderBank != null) {
                gap = sliderBank.getGap();
                w = sliderBank.getSliderWidth() + VALUE_DISPLAY_WIDTH;
            }

            int h = VALUE_DISPLAY_HEIGHT;

            for (int i = 0; i < count; i++) {
                Component temp = parent.getComponent(i);

                int y = (VALUE_DISPLAY_HEIGHT * i) + (gap * i);

                temp.setLocation(0, y);
                temp.setSize(w, h);
            }
        }

    }
}