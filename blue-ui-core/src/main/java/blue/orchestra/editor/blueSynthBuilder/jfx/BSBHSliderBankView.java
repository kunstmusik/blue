/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.orchestra.blueSynthBuilder.BSBHSliderBank;
import java.util.List;
import java.util.stream.Collectors;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

/**
 *
 * @author stevenyi
 */
public class BSBHSliderBankView extends VBox implements ResizeableView {

    BSBHSliderBank bsbHSliderBank;

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    public BSBHSliderBankView(BSBHSliderBank sliderBank) {
        this.bsbHSliderBank = sliderBank;
        setUserData(sliderBank);

        List<Node> views = sliderBank.getSliders().stream()
                .<Node>map(e -> new BSBHSliderView(e))
                .collect(Collectors.toList());
        getChildren().addAll(views);
        
        ChangeListener<String> toolTipListener = (obs, old, newVal) -> {
            var comment = sliderBank.getComment();
            if (comment == null || comment.isBlank()) {
                BSBTooltipUtil.install(this, null);
            } else {
                BSBTooltipUtil.install(this, tooltip);
            }
        };

        ListChangeListener<BSBHSlider> lcl = c -> {
            while (c.next()) {
                if (c.wasPermutated()) {

                } else if (c.wasUpdated()) {

                } else {
                    List<? extends BSBHSlider> removedItems = c.getRemoved();
                    getChildren().removeIf(
                            a -> removedItems.contains(
                                    a.getUserData()));

                    getChildren().addAll(
                            c.getAddedSubList().stream()
                                    .<Node>map(a -> new BSBHSliderView(a))
                                    .collect(Collectors.toList()));

                    toolTipListener.changed(null, null, null);
                }
            }
        };



        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                spacingProperty().unbind();
                sliderBank.getSliders().removeListener(lcl);

                sliderBank.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                BSBTooltipUtil.install(this, null);
            } else {
                spacingProperty().bind(sliderBank.gapProperty());
                sliderBank.getSliders().addListener(lcl);

                sliderBank.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(sliderBank.commentProperty());
                toolTipListener.changed(null, null, null);
            }
        });
        
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return false;
    }

    public int getWidgetMinimumWidth() {
        int base = bsbHSliderBank.isValueDisplayEnabled() ? 50 : 0;
        return 45 + base;
    }

    public int getWidgetMinimumHeight() {
        return -1;
    }

    public int getWidgetWidth() {
        int base = bsbHSliderBank.isValueDisplayEnabled() ? 50 : 0;
        return base + bsbHSliderBank.getSliderWidth();
    }

    public void setWidgetWidth(int width) {
        int base = bsbHSliderBank.isValueDisplayEnabled() ? 50 : 0;
        bsbHSliderBank.setSliderWidth(Math.max(45, width - base));
    }

    public int getWidgetHeight() {
        return -1;
    }

    public void setWidgetHeight(int height) {
    }

    public void setWidgetX(int x) {
        bsbHSliderBank.setX(x);
    }

    public int getWidgetX() {
        return bsbHSliderBank.getX();
    }

    public void setWidgetY(int y) {
    }

    public int getWidgetY() {
        return -1;
    }
}
