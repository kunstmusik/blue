/*
 * blue - object composition environment for csound
 * Copyright (C) 2026
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
package blue.ui.utilities;

/**
 * Interface for header list panels that provide layer selection.
 * Used by ScoreTopComponent to coordinate selection across layer groups.
 *
 * @author stevenyi
 */
public interface LayerSelectionProvider {

    SelectionModel getSelectionModel();

    int getLayerCount();

    default void setCoordinator(LayerSelectionCoordinator coordinator) {}

    default LayerSelectionCoordinator getCoordinator() { return null; }

    /**
     * Remove the currently selected layers from this provider's layer group.
     * Called during cross-group removal to remove layers from each group
     * that has a selection. If deleteEmptyGroup is true, the layer group
     * itself should be removed from the Score when all its layers are deleted.
     */
    default void removeSelectedLayers(boolean deleteEmptyGroup) {}
}
