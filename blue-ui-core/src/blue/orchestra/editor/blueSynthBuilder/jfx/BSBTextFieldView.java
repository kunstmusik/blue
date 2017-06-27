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

import blue.orchestra.blueSynthBuilder.BSBTextField;
import javafx.scene.control.TextField;

/**
 *
 * @author stevenyi
 */
public class BSBTextFieldView extends TextField implements ResizeableView {
    BSBTextField tf;

    public BSBTextFieldView(BSBTextField tf) {
        this.tf = tf;
        setUserData(tf);

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                prefWidthProperty().unbind();
                textProperty().unbindBidirectional(tf.valueProperty());
            } else {
                prefWidthProperty().bind(tf.textFieldWidthProperty());
                textProperty().bindBidirectional(tf.valueProperty());
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

    public void setWidgetHeight(int height){
    } 

    public void setWidgetX(int x) {
        tf.setX(x);
    }

    public int getWidgetX() {
        return tf.getX();
    }

    public void setWidgetY(int y){
        tf.setY(y);
    }

    public int getWidgetY() {
        return tf.getY();
    }

}
