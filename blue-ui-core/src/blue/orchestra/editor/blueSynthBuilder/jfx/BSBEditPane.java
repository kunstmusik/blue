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
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;

/**
 *
 * @author stevenyi
 */
public class BSBEditPane extends Pane {

    BSBObjectEntry[] bsbObjectEntries;
    BSBGraphicInterface bsbInterface;
    BSBEditSelection selection;

    public BSBEditPane(BSBObjectEntry[] bsbObjectEntries) {
        this.bsbObjectEntries = bsbObjectEntries;
        selection = new BSBEditSelection();
    }

    public void editBSBGraphicInterface(BSBGraphicInterface bsbInterface) {

        if (this.bsbInterface != null) {
//            this.bsbInterface.getGridSettings().removePropertyChangeListener(
//                    this);
        }

        this.bsbInterface = null;

        getChildren().clear();

        this.bsbInterface = bsbInterface;

        if (bsbInterface != null) {
            for (BSBObject bsbObj : bsbInterface) {
                addBSBObject(bsbObj);
            }
//            this.selectionList.setGridSettings(bsbInterface.getGridSettings());
//            bsbInterface.getGridSettings().addPropertyChangeListener(this);
        }


//        recalculateSize();
//        revalidate();
//        repaint();
    }


//    /**
//     * Called when adding a new BSBObject or when pasting.
//     *
//     * @param bsbObj
//     */
//    public BSBObjectViewHolder addBSBObject(BSBObject bsbObj) {
//        return addBSBObject(bsbObj, true);
//    }

    public BSBObjectViewHolder addBSBObject(BSBObject bsbObj) {
        Region objectView = BSBObjectEditorFactory.getView(bsbObj);
        BSBObjectViewHolder viewHolder = new BSBObjectViewHolder(bsbInterface,
                selection, objectView);

        getChildren().add(viewHolder);

        return viewHolder;
    }
}
