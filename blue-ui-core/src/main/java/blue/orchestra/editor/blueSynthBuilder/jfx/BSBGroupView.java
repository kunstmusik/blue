/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
import blue.orchestra.editor.blueSynthBuilder.EditModeOnly;
import javafx.beans.binding.Bindings;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.collections.ObservableList;
import javafx.collections.SetChangeListener;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.layout.Background;
import javafx.scene.layout.BackgroundFill;
import javafx.scene.layout.Border;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.BorderStroke;
import javafx.scene.layout.BorderStrokeStyle;
import javafx.scene.layout.BorderWidths;
import javafx.scene.layout.CornerRadii;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BSBGroupView extends BorderPane implements ResizeableView {

    private final Label label = new Label();
    private final Pane editorPane = new Pane();
    private final Pane containerPane = new Pane();
    private final Pane resizePane = new Pane();
    private BooleanProperty editEnabledProperty = null;
    private BSBEditSelection selection;
    private ObservableList<BSBGroup> groupsList;
    private final BSBGroup bsbGroup;

    SetChangeListener<BSBObject> scl = sce -> {
        if (sce.wasAdded()) {
            addBSBObject(sce.getElementAdded());
        } else {
            removeBSBObject(sce.getElementRemoved());
        }
    };

    public BSBGroupView(BSBGroup bsbGroup) {
        setUserData(bsbGroup);
        this.bsbGroup = bsbGroup;

        label.setStyle("-fx-font-smooth-type: lcd;");
        label.setAlignment(Pos.CENTER);
        label.setPadding(new Insets(2, 8, 2, 8));

        editorPane.setPadding(new Insets(0, 9, 9, 0));

        containerPane.getChildren().addAll(resizePane, editorPane);

        setTop(label);
        setCenter(containerPane);
        editorPane.setMinSize(20.0, 20.0);
        label.setMaxWidth(Double.MAX_VALUE);
        updateBackgroundColor();
        updateBorderColor();

        ChangeListener bgColorListener = (obs, old, newVal) -> {
            updateBackgroundColor();
        };

        ChangeListener borderColorListener = (obs, old, newVal) -> {
            updateBorderColor();
        };

        ChangeListener<Boolean> titleEnabledLIstener = (obs, old, newVal) -> {
            if (newVal) {
                setTop(label);
            } else {
                setTop(null);
            }
        };

        sceneProperty().addListener((ObservableValue<? extends Scene> obs, Scene old, Scene newVal) -> {
            if (newVal == null) {
                label.textProperty().unbind();
                bsbGroup.interfaceItemsProperty().removeListener(scl);
                bsbGroup.backgroundColorProperty().removeListener(bgColorListener);
                bsbGroup.borderColorProperty().removeListener(borderColorListener);
                label.textFillProperty().unbind();
                bsbGroup.titleEnabledProperty().removeListener(titleEnabledLIstener);
                resizePane.prefWidthProperty().unbind();
                resizePane.prefHeightProperty().unbind();
            } else {
                label.textProperty().bind(bsbGroup.groupNameProperty());
                bsbGroup.interfaceItemsProperty().addListener(scl);
                bsbGroup.backgroundColorProperty().addListener(bgColorListener);
                bsbGroup.borderColorProperty().addListener(borderColorListener);
                label.textFillProperty().bind(bsbGroup.labelTextColorProperty());

                if (bsbGroup.isTitleEnabled()) {
                    setTop(label);
                } else {
                    setTop(null);
                }
                bsbGroup.titleEnabledProperty().addListener(titleEnabledLIstener);

                resizePane.prefWidthProperty().bind(
                        Bindings.createDoubleBinding(() -> {
                            return Math.max(bsbGroup.getWidth(), editorPane.prefWidth(USE_PREF_SIZE));
                        }, bsbGroup.widthProperty(), editorPane.boundsInParentProperty()));
                resizePane.prefHeightProperty().bind(
                        Bindings.createDoubleBinding(() -> {
                           return Math.max(bsbGroup.getHeight(), editorPane.prefHeight(USE_PREF_SIZE)); 
                        }, bsbGroup.heightProperty(), editorPane.boundsInParentProperty()));
            }
        });
    

    }

    private void updateBackgroundColor() {
        resizePane.setBackground(
                new Background(
                        new BackgroundFill(bsbGroup.getBackgroundColor(), CornerRadii.EMPTY, Insets.EMPTY)));

    }

    private void updateBorderColor() {
        label.setBackground(
                new Background(
                        new BackgroundFill(bsbGroup.getBorderColor(), new CornerRadii(4, 4, 0, 0, false), Insets.EMPTY)));
        resizePane.setBorder(new Border(new BorderStroke(bsbGroup.getBorderColor(), BorderStrokeStyle.SOLID, CornerRadii.EMPTY, new BorderWidths(1))));
    }

    public void initialize(BooleanProperty editEnabledProperty, BSBEditSelection selection,
            ObservableList<BSBGroup> groupsList) {
        this.editEnabledProperty = editEnabledProperty;
        this.selection = selection;
        this.groupsList = groupsList;

        for (BSBObject bsbObj : bsbGroup) {
            addBSBObject(bsbObj);
        }
    }

    protected void addBSBObject(BSBObject bsbObj) {
        try {
            Region objectView = BSBObjectEditorFactory.getView(bsbObj);
            // FIXME
//            BooleanProperty editEnabledProperty = allowEditing ? bsbInterface.editEnabledProperty() : null;
            BSBObjectViewHolder viewHolder = new BSBObjectViewHolder(editEnabledProperty,
                    selection, groupsList, objectView);
            if (objectView instanceof EditModeOnly) {
                if (editEnabledProperty != null) {
                    viewHolder.visibleProperty().bind(editEnabledProperty);
                } else {
                    viewHolder.setVisible(false);
                }
            }
            if (bsbObj instanceof BSBGroup) {
                BSBGroupView bsbGroupView = (BSBGroupView) objectView;
                bsbGroupView.initialize(editEnabledProperty, selection, groupsList);
            }
            editorPane.getChildren().add(viewHolder);
        } catch (Exception e) {
            Exceptions.printStackTrace(e);
        }
    }

    protected void removeBSBObject(BSBObject bsbObj) {
        Node found = null;
        for (Node n : editorPane.getChildren()) {
            if (n.getUserData() == bsbObj) {
                found = n;
                break;
            }
        }

        if (found != null) {
            editorPane.getChildren().remove(found);
            found.visibleProperty().unbind();
        }
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        double base = editorPane.prefWidth(editorPane.getPrefHeight());
        if(getTop() == label) {
            base = Math.max(label.minWidth(label.getPrefHeight()), base);
        }
        return Math.max(20, (int)base);
    }

    public int getWidgetMinimumHeight() {
        double base = (getTop() == label) ?  label.minHeight(label.getPrefWidth()) : 0;
        return Math.max(20, 
                (int)(base + editorPane.prefHeight(editorPane.getPrefWidth())));
    }

    public int getWidgetWidth() {
        return (int)getWidth();
    }

    public void setWidgetWidth(int width) {
        bsbGroup.setWidth(width);
    }

    public int getWidgetHeight() {
        return (int)getHeight();
    }

    public void setWidgetHeight(int height) {
       double base = (getTop() == label) ?  label.prefHeight(label.getPrefWidth()) : 0;
       bsbGroup.setHeight(height - (int)base); 
    }

    public void setWidgetX(int x) {
        bsbGroup.setX(x);
    }

    public int getWidgetX() {
        return bsbGroup.getX();
    }

    public void setWidgetY(int y) {
        bsbGroup.setY(y);
    }

    public int getWidgetY() {
        return bsbGroup.getY();
    }
}
