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

import blue.orchestra.blueSynthBuilder.BSBDropdown;
import blue.orchestra.blueSynthBuilder.BSBDropdownItem;
import javafx.scene.control.ComboBox;

/**
 *
 * @author stevenyi
 */
public class BSBDropdownView extends ComboBox<BSBDropdownItem> {

    private final BSBDropdown dropdown;

    public BSBDropdownView(BSBDropdown dropdown) {
        super(dropdown.dropdownItemsProperty());
        setUserData(dropdown);
        this.dropdown = dropdown;
        setPrefWidth(USE_COMPUTED_SIZE);

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                dropdown.selectedIndexProperty().unbind();
            } else {
                getSelectionModel().select(dropdown.getSelectedIndex());
                dropdown.selectedIndexProperty().bind(
                        getSelectionModel().selectedIndexProperty());
            }
        });
    }

}
