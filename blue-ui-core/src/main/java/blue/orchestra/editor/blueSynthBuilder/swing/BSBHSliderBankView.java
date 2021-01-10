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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.orchestra.blueSynthBuilder.BSBHSliderBank;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;
import java.util.List;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;

/**
 * @author steven
 */
public class BSBHSliderBankView extends BSBObjectView<BSBHSliderBank> {

    private static final int VALUE_DISPLAY_HEIGHT = 30;

    private static final int VALUE_DISPLAY_WIDTH = 50;

    private final ListChangeListener<BSBHSlider> sliderNumListener;
    private final ChangeListener sizeChangeListener;
    
    /**
     * @param slider
     */
    public BSBHSliderBankView(BSBHSliderBank sliderBank) {
        super(sliderBank);

        this.setLayout(new VSliderBankLayout());

        resetSlidersUI();
        
        sliderNumListener = c -> {
            resetSlidersUI();
        };
        
        sizeChangeListener = (obs, old, newVal) -> {
            this.setSize(getPreferredSize());
            revalidate();
        };
    }

    private void resetSlidersUI() {

        this.removeAll();

        if (getBSBObject() == null) {
            return;
        }

        List<BSBHSlider> sliders = getBSBObject().getSliders();

        for (BSBHSlider vSlider : sliders) {
            this.add(new BSBHSliderView(vSlider));

        }
        this.setSize(getPreferredSize());
    }

    @Override
    public void addNotify() {
        super.addNotify(); 
        bsbObj.getSliders().addListener(sliderNumListener);
        bsbObj.gapProperty().addListener(sizeChangeListener);
        bsbObj.sliderWidthProperty().addListener(sizeChangeListener);
        bsbObj.valueDisplayEnabledProperty().addListener(sizeChangeListener);
    }

    @Override
    public void removeNotify() {
        super.removeNotify(); 
        bsbObj.getSliders().removeListener(sliderNumListener);
        bsbObj.gapProperty().removeListener(sizeChangeListener);
        bsbObj.sliderWidthProperty().removeListener(sizeChangeListener);
        bsbObj.valueDisplayEnabledProperty().removeListener(sizeChangeListener);
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

//            if (parent.getParent() == null) {
//                return new Dimension(0, 0);
//            }

            
            int w = bsbObj.isValueDisplayEnabled() ? 
                    getBSBObject().getSliderWidth() + VALUE_DISPLAY_WIDTH :
                    getBSBObject().getSliderWidth();
            int h = (VALUE_DISPLAY_HEIGHT * count)
                    + (getBSBObject().getGap() * (count - 1));

            return new Dimension(w, h);
        }

        @Override
        public void layoutContainer(Container parent) {
            int count = parent.getComponentCount();
            if (count == 0) {
                return;
            }

//            if (parent.getParent() == null) {
//                return;
//            }

            int gap = 0;
            int w = 0;

            if (getBSBObject() != null) {
                gap = getBSBObject().getGap();
                
                w = bsbObj.isValueDisplayEnabled() ? 
                    getBSBObject().getSliderWidth() + VALUE_DISPLAY_WIDTH :
                    getBSBObject().getSliderWidth();
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
