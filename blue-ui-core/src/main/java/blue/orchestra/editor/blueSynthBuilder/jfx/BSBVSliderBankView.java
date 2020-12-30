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

import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.orchestra.blueSynthBuilder.BSBVSliderBank;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import java.util.List;
import java.util.stream.Collectors;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;

/**
 *
 * @author stevenyi
 */
public class BSBVSliderBankView extends HBox implements ResizeableView {

    BSBVSliderBank bsbVSliderBank;

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    public BSBVSliderBankView(BSBVSliderBank sliderBank) {
        this.bsbVSliderBank = sliderBank;
        setUserData(sliderBank);

        List<Node> views = sliderBank.getSliders().stream()
                .<Node>map(e -> new BSBVSliderView(e))
                .collect(Collectors.toList());
        getChildren().addAll(views);

        ChangeListener<Object> toolTipListener = (obs, old, newVal) -> {
            BlueFX.runOnFXThread(() -> {
                var comment = sliderBank.getComment();
                var showComments = BSBPreferences.getInstance().getShowWidgetComments();
                if (comment == null || comment.isBlank() || !showComments) {
                    BSBTooltipUtil.install(this, null);
                } else {
                    BSBTooltipUtil.install(this, tooltip);
                }
            });
        };

        ListChangeListener<BSBVSlider> lcl = c -> {
            while (c.next()) {
                if (c.wasPermutated()) {

                } else if (c.wasUpdated()) {

                } else {
                    List<? extends BSBVSlider> removedItems = c.getRemoved();
                    getChildren().removeIf(
                            a -> removedItems.contains(
                                    a.getUserData()));

                    getChildren().addAll(
                            c.getAddedSubList().stream()
                                    .<Node>map(a -> new BSBVSliderView(a))
                                    .collect(Collectors.toList()));

                    toolTipListener.changed(null, null, null);

                }
            }
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                spacingProperty().unbind();
                sliderBank.getSliders().removeListener(lcl);

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .removeListener(toolTipListener);

                sliderBank.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                BSBTooltipUtil.install(this, null);
            } else {
                spacingProperty().bind(sliderBank.gapProperty());
                sliderBank.getSliders().addListener(lcl);

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .addListener(toolTipListener);

                sliderBank.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(sliderBank.commentProperty());
                toolTipListener.changed(null, null, null);
            }
        });
    }

    public boolean canResizeWidgetWidth() {
        return false;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        return -1;
    }

    public int getWidgetMinimumHeight() {
        int base = bsbVSliderBank.isValueDisplayEnabled() ? 30 : 0;
        return 45 + base;
    }

    public int getWidgetWidth() {
        return -1;
    }

    public void setWidgetWidth(int width) {
    }

    public int getWidgetHeight() {
        int base = bsbVSliderBank.isValueDisplayEnabled() ? 30 : 0;
        return base + bsbVSliderBank.getSliderHeight();
    }

    public void setWidgetHeight(int height) {
        int base = bsbVSliderBank.isValueDisplayEnabled() ? 30 : 0;
        bsbVSliderBank.setSliderHeight(Math.max(45, height - base));
    }

    public void setWidgetX(int x) {
    }

    public int getWidgetX() {
        return -1;
    }

    public void setWidgetY(int y) {
        bsbVSliderBank.setY(y);
    }

    public int getWidgetY() {
        return bsbVSliderBank.getY();
    }
}
