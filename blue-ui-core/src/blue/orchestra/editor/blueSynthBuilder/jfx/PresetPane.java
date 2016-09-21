/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
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

import blue.orchestra.blueSynthBuilder.PresetGroup;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;

/**
 *
 * @author stevenyi
 */
public class PresetPane extends HBox {
   
    private ObjectProperty<PresetGroup> presetGroup;

    public PresetPane() {

        presetGroup = new SimpleObjectProperty<>();

        Button presetsButton = new Button("Presets");
        TextField text = new TextField();
        text.setEditable(false);
        Button updateButton = new Button("Update");

        HBox.setHgrow(text, Priority.ALWAYS);
        getChildren().addAll(presetsButton, text, updateButton);
        setMargin(presetsButton, new Insets(5));
        setMargin(text, new Insets(5, 0, 5, 0));
        setMargin(updateButton, new Insets(5, 5, 5, 0));

        setAlignment(Pos.CENTER);
    }

    public PresetGroup getPresetGroup() {
        return presetGroup.get();
    }

    public void setPresetGroup(PresetGroup presetGroup) {
        this.presetGroup.set(presetGroup);
    } 

    public ObjectProperty<PresetGroup> presetGroupProperty() {
        return presetGroup; 
    }   
}
