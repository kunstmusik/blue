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
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import javafx.collections.SetChangeListener;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.MenuItem;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BSBEditPane extends Pane {

    private BSBGraphicInterface bsbInterface;
    private BSBEditSelection selection;

    private ContextMenu popupMenu;

    private SetChangeListener<BSBObject> scl;
    
    private Rectangle marquee;
    int addX = 0, addY = 0;

    public BSBEditPane(BSBObjectEntry[] bsbObjectEntries) {
        selection = new BSBEditSelection();

        popupMenu = new ContextMenu();
        EventHandler<ActionEvent> al = e -> {
            MenuItem m = (MenuItem) e.getSource();
            Class<? extends BSBObject> clazz = (Class<? extends BSBObject>) m.getUserData();
            try {
                BSBObject bsbObj = clazz.newInstance();
                bsbObj.setX(addX);
                bsbObj.setY(addY);
                bsbInterface.addBSBObject(bsbObj);
            } catch (InstantiationException | IllegalAccessException ex) {
                Exceptions.printStackTrace(ex);
            }
        };

        for (BSBObjectEntry entry : bsbObjectEntries) {
            MenuItem m = new MenuItem("Add " + entry.label);
            m.setUserData(entry.bsbObjectClass);
            m.setOnAction(al);
            popupMenu.getItems().add(m);
        }

        marquee = new Rectangle();
        marquee.setFill(null);
        marquee.setStroke(Color.WHITE);

        setOnMousePressed(me -> {
            if (!me.isConsumed() && bsbInterface != null && bsbInterface.isEditEnabled()) {
                if (me.isSecondaryButtonDown()) {
                    addX = (int) me.getX();
                    addY = (int) me.getY();
                    popupMenu.show(BSBEditPane.this, me.getScreenX(), me.getScreenY());
                } else if(me.isPrimaryButtonDown()) {
                    if(!me.isShiftDown()) {
                        selection.selection.clear();
                    }            
                }
            }
        });

        scl = sce -> {
            if (sce.wasAdded()) {
                addBSBObject(sce.getElementAdded());
            } else {
                removeBSBObject(sce.getElementRemoved());
            }
        };
    }

    public void editBSBGraphicInterface(BSBGraphicInterface bsbInterface) {

        if (this.bsbInterface != null) {
//            this.bsbInterface.getGridSettings().removePropertyChangeListener(
//                    this);
            this.bsbInterface.interfaceItemsProperty().removeListener(scl);
        }

        getChildren().clear();

        this.bsbInterface = bsbInterface;
        selection.setBSBGraphicInterface(bsbInterface);

        if (bsbInterface != null) {
            for (BSBObject bsbObj : bsbInterface) {
                addBSBObject(bsbObj);
            }
//            this.selectionList.setGridSettings(bsbInterface.getGridSettings());
//            bsbInterface.getGridSettings().addPropertyChangeListener(this);
            bsbInterface.interfaceItemsProperty().addListener(scl);
        }

    }

    protected void addBSBObject(BSBObject bsbObj) {
        try {
            Region objectView = BSBObjectEditorFactory.getView(bsbObj);
            BSBObjectViewHolder viewHolder = new BSBObjectViewHolder(bsbInterface,
                    selection, objectView);

            getChildren().add(viewHolder);
        } catch (Exception e) {
            Exceptions.printStackTrace(e);
        }
    }

    protected void removeBSBObject(BSBObject bsbObj) {
        Node found = null;
        for (Node n : getChildren()) {
            if (n.getUserData() == bsbObj) {
                found = n;
                break;
            }
        }

        if (found != null) {
            getChildren().remove(found);
        }
    }
}
