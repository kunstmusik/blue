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
import javafx.scene.Node;
import javafx.scene.layout.Pane;

/**
 *
 * @author stevenyi
 */
public class BSBEditPane extends Pane {

    BSBObjectEntry[] bsbObjectEntries;
    BSBGraphicInterface bsbInterface;

    public BSBEditPane(BSBObjectEntry[] bsbObjectEntries) {
    }


    public void editBSBGraphicInterface(BSBGraphicInterface bsbInterface) {

//      Commented out to fix issue with updating interface after setting preset
//      However, the whole code for updating from presets needs to be fixed
//      so that UI is only listening to changes from data model
//        if (this.bsbInterface == bsbInterface) {
//            return;
//        }

        if (this.bsbInterface != null) {
//            this.bsbInterface.getGridSettings().removePropertyChangeListener(
//                    this);
        }

        this.bsbInterface = null;

//        this.selectionList.setGridSettings(null);

        getChildren().clear();

        if (bsbInterface != null) {
            for (BSBObject bsbObj : bsbInterface) {
                addBSBObject(bsbObj, false);
            }
//            this.selectionList.setGridSettings(bsbInterface.getGridSettings());
//            bsbInterface.getGridSettings().addPropertyChangeListener(this);
        }

        this.bsbInterface = bsbInterface;

//        recalculateSize();

//        revalidate();
//        repaint();

    }
    
    private void clearBSBObjects() {

//        this.removeAll();

//        this.add(marquee, JLayeredPane.DRAG_LAYER);
//        marquee.setVisible(false);

//        for (BSBObjectViewHolder viewHolder : objectViews) {
//            viewHolder.removeSelectionListener(this);
//            viewHolder.setGroupMovementListener(null);
//            viewHolder.removeComponentListener(cl);
//            viewHolder.getBSBObjectView().cleanup();
//        }
//
//        objectViews.clear();
    }
    
    /**
     * Called when adding a new BSBObject or when pasting.
     *
     * @param bsbObj
     */
    public BSBObjectViewHolder addBSBObject(BSBObject bsbObj) {
        return addBSBObject(bsbObj, true);
    }

    public BSBObjectViewHolder addBSBObject(BSBObject bsbObj, boolean revalidate) {
        if (bsbInterface != null) {
            bsbInterface.addBSBObject(bsbObj);
        }

        Node objectView = BSBObjectEditorFactory.getView(bsbObj);
        BSBObjectViewHolder viewHolder = new BSBObjectViewHolder(objectView);

//        viewHolder.setEditing(this.isEditing());
viewHolder.setLayoutX(bsbObj.getX());
viewHolder.setLayoutY(bsbObj.getY());
getChildren().add(viewHolder);
//        viewHolder.setLocation(bsbObj.getX(), bsbObj.getY());
//        objectViews.add(viewHolder);

//        this.add(viewHolder);

//        viewHolder.addSelectionListener(this);
//        viewHolder.setGroupMovementListener(selectionList);
//        viewHolder.addComponentListener(cl);

//        if (revalidate) {
//            revalidate();
//            repaint();
//        }

        return viewHolder;
    }
}
