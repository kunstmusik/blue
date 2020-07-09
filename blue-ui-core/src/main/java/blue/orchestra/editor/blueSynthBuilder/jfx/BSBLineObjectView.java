/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
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

import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.orchestra.blueSynthBuilder.BSBLineObject;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.BorderPane;

/**
 *
 * @author stevenyi
 */
public class BSBLineObjectView extends BorderPane implements ResizeableView {

    BSBLineObject lines;
    LineSelector selector;

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    public BSBLineObjectView(BSBLineObject lines) {
        this.lines = lines;
        setUserData(lines);

        selector = new LineSelector(lines.getLines());

        LineView lineView = new LineView(lines.getLines());

        lineView.selectedLineProperty().bind(selector.selectedLineProperty());

        setCenter(lineView);
        setBottom(selector);

        setStyle("-fx-border-color:gray;");

        ListChangeListener<Line> linesListener = e -> {
            if (!lines.getLines().contains(selector.selectedLineProperty().get())) {
                LineList newLines = lines.getLines();
                if (newLines.size() > 0) {
                    selector.setSelectedLine(newLines.get(0));
                } else {
                    selector.setSelectedLine(null);
                }
            }
            selector.leftButton.setDisable(lines.getLines().size() < 2);
            selector.rightButton.setDisable(lines.getLines().size() < 2);
            lineView.repaint();
        };

        ChangeListener<String> toolTipListener = (obs, old, newVal) -> {
            var comment = lines.getComment();
            if (comment == null || comment.isBlank()) {
                BSBTooltipUtil.install(this, null);
            } else {
                BSBTooltipUtil.install(this, tooltip);
            }
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                lineView.widthProperty().unbind();
                lineView.heightProperty().unbind();
                selector.prefWidthProperty().unbind();
                lineView.lockedProperty().unbind();
                lines.getLines().removeListener(linesListener);

                lines.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                BSBTooltipUtil.install(this, null);
            } else {
                lineView.widthProperty().bind(lines.canvasWidthProperty());
                lineView.heightProperty().bind(lines.canvasHeightProperty());
                selector.prefWidthProperty().bind(lines.canvasWidthProperty());
                lineView.lockedProperty().bind(lines.lockedProperty());
                lines.getLines().addListener(linesListener);

                lines.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(lines.commentProperty());
                toolTipListener.changed(null, null, null);
            }
        });

        selector.leftButton.setDisable(lines.getLines().size() < 2);
        selector.rightButton.setDisable(lines.getLines().size() < 2);
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        return 40;
    }

    public int getWidgetMinimumHeight() {
//        int base = lines.isValueDisplayEnabled() ? (int) label.getHeight() : 0;
//        return base + 20;
        return 40 + (int) selector.getHeight();
    }

    public int getWidgetWidth() {
        return lines.getCanvasWidth();
    }

    public void setWidgetWidth(int width) {
        lines.setCanvasWidth(Math.max(40, width));
    }

    public int getWidgetHeight() {
//        int base = bsbXYController.isValueDisplayEnabled() ? (int) label.getHeight() : 0;
//        return bsbXYController.getHeight() + base;
        return lines.getCanvasHeight() + (int) selector.getHeight();
    }

    public void setWidgetHeight(int height) {
//        int base = bsbXYController.isValueDisplayEnabled() ? (int) label.getHeight() : 0;
//        bsbXYController.setHeight(height - base);
        lines.setCanvasHeight(height - (int) selector.getHeight());
    }

    public void setWidgetX(int x) {
        lines.setX(x);
    }

    public int getWidgetX() {
        return lines.getX();
    }

    public void setWidgetY(int y) {
        lines.setY(y);
    }

    public int getWidgetY() {
        return lines.getY();
    }
}
