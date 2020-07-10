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
import blue.orchestra.blueSynthBuilder.BSBTextField;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;

/**
 *
 * @author stevenyi
 */
public class BSBTextFieldView extends TextField implements ResizeableView {

    BSBTextField tf;

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    public BSBTextFieldView(BSBTextField tf) {
        this.tf = tf;
        setUserData(tf);

        ChangeListener<Object> toolTipListener = (obs, old, newVal) -> {
            BlueFX.runOnFXThread(() -> {
                var comment = tf.getComment();
                var showComments = BSBPreferences.getInstance().getShowWidgetComments();
                if (comment == null || comment.isBlank() || !showComments) {
                    setTooltip(null);
                } else {
                    setTooltip(tooltip);
                }
            });
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                prefWidthProperty().unbind();
                textProperty().unbindBidirectional(tf.valueProperty());

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .removeListener(toolTipListener);

                tf.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                setTooltip(null);
            } else {
                prefWidthProperty().bind(tf.textFieldWidthProperty());
                textProperty().bindBidirectional(tf.valueProperty());

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .addListener(toolTipListener);

                tf.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(tf.commentProperty());
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
        return 5;
    }

    public int getWidgetMinimumHeight() {
        return -1;
    }

    public int getWidgetWidth() {
        return tf.getTextFieldWidth();
    }

    public void setWidgetWidth(int width) {
        tf.setTextFieldWidth(Math.max(5, width));
    }

    public int getWidgetHeight() {
        return -1;
    }

    public void setWidgetHeight(int height) {
    }

    public void setWidgetX(int x) {
        tf.setX(x);
    }

    public int getWidgetX() {
        return tf.getX();
    }

    public void setWidgetY(int y) {
        tf.setY(y);
    }

    public int getWidgetY() {
        return tf.getY();
    }

}
