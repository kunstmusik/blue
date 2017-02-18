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

import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import java.util.List;
import java.util.stream.Collectors;
import javafx.beans.binding.Bindings;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.collections.ObservableList;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.scene.Scene;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Menu;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SeparatorMenuItem;
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

    Region bsbObjectView;

    public BSBObjectViewHolder(BooleanProperty editEnabledProperty,
            BSBEditSelection selection,
            ObservableList<BSBGroup> groupsList,
            Region bsbObjView) {

        final BSBObject bsbObj = (BSBObject) bsbObjView.getUserData();
        this.bsbObjectView = bsbObjView;
        setUserData(bsbObj);
        Pane mousePane = new Pane();
        setFocusTraversable(true);

        mousePane.setOnMousePressed(me -> {
            if (!groupsList.get(groupsList.size() - 1).contains(bsbObj)) {
                return;
            }
            me.consume();
            getParent().requestFocus();
            if (me.isSecondaryButtonDown()) {
                ContextMenu menu = getContextMenu();
                menu.setUserData(new MenuData(selection, groupsList));
                menu.show(BSBObjectViewHolder.this, me.getScreenX(), me.getScreenY());
                return;
            }

            if (me.getClickCount() >= 2 && (bsbObj instanceof BSBGroup)) {
                groupsList.add((BSBGroup) bsbObj);
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
            if (!groupsList.get(groupsList.size() - 1).contains(bsbObj)) {
                return;
            }
            selection.move(me.getSceneX() - startX, me.getSceneY() - startY);
        });

        mousePane.setOnMouseReleased(me -> {
            if (!groupsList.get(groupsList.size() - 1).contains(bsbObj)) {
                return;
            }
            selection.endMove();
        });

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
        if (editEnabledProperty != null) {
            rect.visibleProperty().bind(
                    Bindings.createBooleanBinding(
                            () -> editEnabledProperty.get()
                            && selection.selection.contains(bsbObj),
                            editEnabledProperty,
                            selection.selection
                    ));
        }

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

                    if (editEnabledProperty != null) {
                        mousePane.mouseTransparentProperty().bind(
                                editEnabledProperty.not());
                    } else {
                        mousePane.setMouseTransparent(true);
                    }

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
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                selection.cut();
            });
            MenuItem copy = new MenuItem("Copy");
            copy.setOnAction(e -> {
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                selection.copy();
            });

            MenuItem remove = new MenuItem("Remove");
            remove.setOnAction(e -> {
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                selection.remove();
            });

            MenuItem makeGroup = new MenuItem("Make Group");
            makeGroup.setOnAction(e -> {
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                List<BSBGroup> groupsList = data.groupsList;
                
                List<BSBObject> bsbObjs = selection.selection.stream()
                        .map(b -> b.deepCopy())
                        .collect(Collectors.toList());
                int x = Integer.MAX_VALUE;                
                int y = Integer.MAX_VALUE;                

                for(BSBObject bsbObj : bsbObjs) {
                    x = Math.min(x, bsbObj.getX());
                    y = Math.min(y, bsbObj.getY());
                }

                for(BSBObject bsbObj : bsbObjs) {
                    bsbObj.setX(bsbObj.getX() - x + 10);
                    bsbObj.setY(bsbObj.getY() - y + 10);
                }

                selection.remove();

                BSBGroup group = new BSBGroup();
                group.interfaceItemsProperty().addAll(bsbObjs);
                group.setX(x);
                group.setY(y);

                groupsList.get(groupsList.size() - 1).addBSBObject(group);
            });

            final Menu align = new Menu("Align");
            final Menu distribute = new Menu("Distribute");

            EventHandler<ActionEvent> alignListener = ae -> {
                MenuItem source = (MenuItem) ae.getSource();
                Alignment alignment = (Alignment) source.getUserData();
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                AlignmentUtils.align(selection.getSelectedNodes(), alignment);
            };
            EventHandler<ActionEvent> distributeListener = ae -> {
                MenuItem source = (MenuItem) ae.getSource();
                Alignment alignment = (Alignment) source.getUserData();
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                AlignmentUtils.distribute(selection.getSelectedNodes(), alignment);
            };

            for (Alignment alignment : Alignment.values()) {
                MenuItem a = new MenuItem(alignment.toString());
                a.setUserData(alignment);
                a.setOnAction(alignListener);

                MenuItem d = new MenuItem(alignment.toString());
                d.setUserData(alignment);
                d.setOnAction(distributeListener);

                align.getItems().add(a);
                distribute.getItems().add(d);
            }
            MENU.getItems().addAll(cut, copy, remove);
            MENU.getItems().addAll(new SeparatorMenuItem(), makeGroup);
            MENU.getItems().addAll(new SeparatorMenuItem(), align, distribute);
            MENU.setOnHidden(e -> MENU.setUserData(null));

            MENU.setOnShowing(e -> {
                MenuData data = (MenuData)MENU.getUserData();
                BSBEditSelection selection = data.selection;
                align.setDisable(selection.selection.size() < 2);
                distribute.setDisable(selection.selection.size() < 2);
            });
        }
        return MENU;
    }

    public Region getBSBObjectView() {
        return bsbObjectView;
    }

    class MenuData {
        public final BSBEditSelection selection;
        public final List<BSBGroup> groupsList;

        public MenuData(BSBEditSelection selection, 
                List<BSBGroup> groupsList) {
            this.selection = selection;
            this.groupsList = groupsList;
        }
    }
}
