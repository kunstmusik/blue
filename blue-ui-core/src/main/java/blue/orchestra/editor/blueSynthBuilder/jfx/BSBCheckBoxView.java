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

import blue.orchestra.blueSynthBuilder.BSBCheckBox;
import javafx.application.Platform;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.CheckBox;

/**
 *
 * @author stevenyi
 */
public class BSBCheckBoxView extends CheckBox {

    public BSBCheckBoxView(BSBCheckBox checkBox) {
        setUserData(checkBox);

        final boolean[] editing = new boolean[1];
        editing[0] = false;

        ChangeListener<Boolean> cboxToViewListener = (obs, old, newVal) -> {
            if (!editing[0]) {
                editing[0] = true;
                if (!Platform.isFxApplicationThread()) {
                    Platform.runLater(() -> {
                        try {
                            setSelected(newVal);
                        } finally {
                            editing[0] = false;
                        }
                    });

                } else {
                    setSelected(newVal);
                    editing[0] = false;

                }
            }

        };

        ChangeListener<Boolean> viewToCboxListener = (obs, old, newVal) -> {
            if (!editing[0]) {
                editing[0] = true;
                checkBox.setSelected(newVal);
                editing[0] = false;
            }
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
//                this.selectedProperty().unbindBidirectional(checkBox.selectedProperty());
                checkBox.selectedProperty().removeListener(cboxToViewListener);
                this.selectedProperty().removeListener(viewToCboxListener);
                this.textProperty().unbind();
            } else {
                setSelected(checkBox.isSelected());
//                this.selectedProperty().bindBidirectional(checkBox.selectedProperty());
                checkBox.selectedProperty().addListener(cboxToViewListener);
                this.selectedProperty().addListener(viewToCboxListener);
                this.textProperty().bind(checkBox.labelProperty());
            }
        });
    }
}
