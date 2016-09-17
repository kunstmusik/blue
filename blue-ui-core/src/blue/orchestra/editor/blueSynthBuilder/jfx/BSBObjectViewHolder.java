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

import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;

/**
 *
 * @author stevenyi
 */
public class BSBObjectViewHolder extends StackPane {

    double startX = 0.0;
    double startY = 0.0;

    public BSBObjectViewHolder(BSBGraphicInterface bsbGraphicInterface,
            BSBEditSelection selection,
            Region bsbObjView) {

        final BSBObject bsbObj = (BSBObject) bsbObjView.getUserData();
        Pane mousePane = new Pane();

        mousePane.setOnMousePressed(me -> {
            if (me.isPopupTrigger()) {

            } else if (selection.selection.contains(bsbObj)) {
                if (me.isShiftDown()) {
                    selection.selection.remove(bsbObj);
                }
            } else {
                if (!me.isShiftDown()) {
                    selection.selection.clear();
                }
                selection.selection.add(bsbObj);
            }
            selection.initiateMove();
            startX = me.getX();
            startY = me.getY();
            me.consume();
        });

        mousePane.setOnMouseDragged(me -> {
            selection.move(me.getX() - startX, me.getY() - startY);
        });

        mousePane.setOnMouseReleased(me -> selection.endMove());

        this.getChildren().addAll(bsbObjView, mousePane);

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                mousePane.prefWidthProperty().unbind();
                mousePane.prefHeightProperty().unbind();
                mousePane.mouseTransparentProperty().unbind();
            } else {
                mousePane.prefWidthProperty().bind(
                        bsbObjView.prefWidthProperty());
                mousePane.prefHeightProperty().bind(
                        bsbObjView.prefHeightProperty());
                mousePane.mouseTransparentProperty().bind(
                        bsbGraphicInterface.editEnabledProperty().not());

//                layoutXProperty().bind(bsbObjView.getUserData())
            }
        });
    }
}
