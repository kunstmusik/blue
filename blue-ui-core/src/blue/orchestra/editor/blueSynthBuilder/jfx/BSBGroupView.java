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
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ObservableList;
import javafx.collections.SetChangeListener;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Background;
import javafx.scene.layout.BackgroundFill;
import javafx.scene.layout.Border;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.BorderStroke;
import javafx.scene.layout.CornerRadii;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BSBGroupView extends BorderPane {

    private Label label = new Label();
    private Pane editorPane = new Pane();
    private BooleanProperty editEnabledProperty = null;
    private BSBEditSelection selection;
    private ObservableList<BSBGroup> groupsList;
    private BSBGroup bsbGroup;

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

        label.setStyle("-fx-fill: primary3; "
                + "-fx-font-smooth-type: lcd; "
                + "-fx-background-color: -fx-control-inner-background;"
                + "-fx-padding: 2 8 2 8;"
                + "-fx-background-radius: 4 4 0 0;");
        label.setAlignment(Pos.CENTER);

        editorPane.setStyle("-fx-border-color: -fx-control-inner-background;"
                + "-fx-border-width: 1px;"
                + "-fx-padding: 0 9 9 0;");

        setTop(label);
        setCenter(editorPane);
        editorPane.setMinSize(20.0, 20.0);
        label.setMaxWidth(Double.MAX_VALUE);
        updateBackgroundColor();

//        label.setStyle("-fx-background: aliceblue;");
        ChangeListener bgColorListener = (obs, old, newVal) -> {
            updateBackgroundColor();
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                label.textProperty().unbind();
                bsbGroup.interfaceItemsProperty().removeListener(scl);
                bsbGroup.backgroundColorProperty().removeListener(bgColorListener);
            } else {
                label.textProperty().bind(bsbGroup.groupNameProperty());
                bsbGroup.interfaceItemsProperty().addListener(scl);
                bsbGroup.backgroundColorProperty().addListener(bgColorListener);
            }
        });

    }

    private void updateBackgroundColor() {
        editorPane.setBackground(
                new Background(
                        new BackgroundFill(bsbGroup.getBackgroundColor(), CornerRadii.EMPTY, Insets.EMPTY)));

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

}
