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

import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.orchestra.blueSynthBuilder.BSBVSliderBank;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;
import java.util.List;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;

public class BSBVSliderBankView extends BSBObjectView<BSBVSliderBank> {

    private static final int VALUE_DISPLAY_HEIGHT = 30;

    private static final int VALUE_DISPLAY_WIDTH = 50;

    private final ListChangeListener<BSBVSlider> sliderNumListener;
    private final ChangeListener sizeChangeListener;

    /**
     * @param slider
     */
    public BSBVSliderBankView(BSBVSliderBank sliderBank) {
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

        if (bsbObj == null) {
            return;
        }

        List<BSBVSlider> sliders = bsbObj.getSliders();

        for (BSBVSlider vSlider : sliders) {
            this.add(new BSBVSliderView(vSlider));
        }

        this.setSize(getPreferredSize());

    }

    @Override
    public void addNotify() {
        super.addNotify();
        bsbObj.getSliders().addListener(sliderNumListener);
        bsbObj.gapProperty().addListener(sizeChangeListener);
        bsbObj.sliderHeightProperty().addListener(sizeChangeListener);
        bsbObj.valueDisplayEnabledProperty().addListener(sizeChangeListener);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        bsbObj.getSliders().removeListener(sliderNumListener);
        bsbObj.gapProperty().removeListener(sizeChangeListener);
        bsbObj.sliderHeightProperty().removeListener(sizeChangeListener);
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

            int w = (VALUE_DISPLAY_WIDTH * count)
                    + (getBSBObject().getGap() * (count - 1));
            int h = bsbObj.isValueDisplayEnabled()
                    ? getBSBObject().getSliderHeight() + VALUE_DISPLAY_HEIGHT
                    : getBSBObject().getSliderHeight();

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
            int h = 0;

            if (bsbObj != null) {
                gap = bsbObj.getGap();
                
                h = bsbObj.isValueDisplayEnabled() ? 
                    getBSBObject().getSliderHeight()+ VALUE_DISPLAY_HEIGHT :
                    getBSBObject().getSliderHeight();
            }

            for (int i = 0; i < count; i++) {
                Component temp = parent.getComponent(i);

                int x = (VALUE_DISPLAY_WIDTH * i) + (gap * i);

                temp.setLocation(x, 0);
                temp.setSize(VALUE_DISPLAY_WIDTH, h);
            }
        }

    }
}
