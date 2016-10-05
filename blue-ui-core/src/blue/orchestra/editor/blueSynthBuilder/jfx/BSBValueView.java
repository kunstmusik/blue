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

import blue.orchestra.blueSynthBuilder.BSBValue;
import javafx.beans.binding.Bindings;
import javafx.scene.control.Label;
import javafx.scene.layout.Background;
import javafx.scene.layout.BackgroundFill;
import javafx.scene.paint.Color;

/**
 *
 * @author stevenyi
 */
public class BSBValueView extends Label {

    public BSBValueView(BSBValue bsbValue) {
        setUserData(bsbValue);
        setTextFill(Color.WHITE);
        setBackground(new Background(
                new BackgroundFill(Color.color(1, 1, 1, 0.25), null, null)));

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                textProperty().unbind();
            } else {
                textProperty().bind(Bindings.format("Value: <%s>", 
                        bsbValue.objectNameProperty()));
            }
        });
    }
}
