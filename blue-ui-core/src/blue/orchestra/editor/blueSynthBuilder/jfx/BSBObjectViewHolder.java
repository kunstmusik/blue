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
import blue.utility.GUI;
import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.scene.Scene;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Menu;
import javafx.scene.control.MenuItem;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;

/**
 *
 * @author stevenyi
 */
public class BSBObjectViewHolder extends Pane {

    double startX = 0.0;
    double startY = 0.0;

    private static ContextMenu MENU = null;

    public BSBObjectViewHolder(BSBGraphicInterface bsbGraphicInterface,
            BSBEditSelection selection,
            Region bsbObjView) {

        final BSBObject bsbObj = (BSBObject) bsbObjView.getUserData();
        setUserData(bsbObj);
        Pane mousePane = new Pane();

        mousePane.setOnMousePressed(me -> {
            me.consume();
            if (me.isSecondaryButtonDown()) {
                ContextMenu menu = getContextMenu();
                menu.setUserData(selection);
                menu.show(BSBObjectViewHolder.this, me.getScreenX(), me.getScreenY());
                return;
            }

            if (selection.selection.contains(bsbObj)) {
                if (me.isShiftDown()) {
                    selection.selection.remove(bsbObj);
                    return;
                }
            } else {
                if (me.isShiftDown()) {
                    selection.selection.add(bsbObj);
                    return;
                }
                selection.selection.clear();
                selection.selection.add(bsbObj);
            }
            selection.initiateMove(bsbObj);
            startX = me.getSceneX();
            startY = me.getSceneY();
        });

        mousePane.setOnMouseDragged(me -> {
            selection.move(me.getSceneX() - startX, me.getSceneY() - startY);
        });

        mousePane.setOnMouseReleased(me -> selection.endMove());

        Rectangle rect = new Rectangle();
        rect.setStroke(Color.rgb(0, 255, 0));
        rect.widthProperty().bind(mousePane.widthProperty().subtract(1));
        rect.heightProperty().bind(mousePane.heightProperty().subtract(1));
        rect.setMouseTransparent(true);
        rect.setFill(null);
        rect.setVisible(false);
        rect.setLayoutX(0.5);
        rect.setLayoutY(0.5);

        this.getChildren().addAll(bsbObjView, mousePane, rect);

//        SetChangeListener<BSBObject> scl = e -> {
//            rect.setVisible(e.getSet().contains(bsbObj));
//        };
        rect.visibleProperty().bind(
                Bindings.createBooleanBinding(
                        () -> bsbGraphicInterface.isEditEnabled()
                        && selection.selection.contains(bsbObj),
                        bsbGraphicInterface.editEnabledProperty(),
                        selection.selection
                ));

        sceneProperty().addListener(new ChangeListener<Scene>() {
            @Override
            public void changed(ObservableValue<? extends Scene> obs, Scene old, Scene newVal) {
                if (newVal == null) {
                    mousePane.prefWidthProperty().unbind();
                    mousePane.prefHeightProperty().unbind();
                    mousePane.mouseTransparentProperty().unbind();
                    layoutXProperty().unbind();
                    layoutYProperty().unbind();
                } else {
                    mousePane.prefWidthProperty().bind(
                            bsbObjView.widthProperty());
                    mousePane.prefHeightProperty().bind(
                            bsbObjView.heightProperty());
                    mousePane.mouseTransparentProperty().bind(
                            bsbGraphicInterface.editEnabledProperty().not());

                    layoutXProperty().bind(bsbObj.xProperty());
                    layoutYProperty().bind(bsbObj.yProperty());
                }
            }
        });

//        setBorder(new Border(new BorderStroke(Color.rgb(0, 255, 0), BorderStrokeStyle.SOLID, null, BorderWidths.DEFAULT)));
//        border
    }


    private static ContextMenu getContextMenu() {
        if (MENU == null) {
            MENU = new ContextMenu();

            MenuItem cut = new MenuItem("Cut");
            cut.setOnAction(e -> {
                BSBEditSelection selection = (BSBEditSelection) MENU.getUserData();
                selection.cut();
            });
            MenuItem copy = new MenuItem("Copy");
            copy.setOnAction(e -> {
                BSBEditSelection selection = (BSBEditSelection) MENU.getUserData();
                selection.copy();
            });

            MenuItem remove = new MenuItem("Remove");
            remove.setOnAction(e -> {
                BSBEditSelection selection = (BSBEditSelection) MENU.getUserData();
                selection.remove();
            });


//            String[] alignOptions = { "Left", "Horizontal Center", "Right", "Top",
//            "Vertical Center", "Bottom" };
//
//            Menu align = new Menu("Align");
//            Menu distribute = new Menu("Distribute");
//
//            EventHandler<ActionEvent> alignListener = ae -> {
//                MenuItem source = (MenuItem) ae.getSource();
//                int index = (Integer) source.getUserData();
//                GUI.align(jComponents, index);
//            };
//
//            for(int i = 0; i < alignOptions.length; i++) {
//                String s = alignOptions[i];
//
//                MenuItem a = new MenuItem(s);
//                a.setUserData(i);
//                a.setOnAction();
//
//                MenuItem d = new MenuItem(s);
//
//                align.getItems().add(a);
//                align.getItems().add(d);
//            }
            
            MENU.getItems().addAll(cut, copy, remove);
            MENU.setOnHidden(e -> MENU.setUserData(null));
        }
        return MENU;
    }

}
