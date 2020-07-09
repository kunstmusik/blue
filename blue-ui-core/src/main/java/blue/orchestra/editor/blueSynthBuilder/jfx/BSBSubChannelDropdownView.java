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

import blue.BlueData;
import blue.mixer.Channel;
import blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown;
import blue.projects.BlueProjectManager;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.Tooltip;

/**
 *
 * @author stevenyi
 */
public class BSBSubChannelDropdownView extends ChoiceBox<String> {

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    public BSBSubChannelDropdownView(BSBSubChannelDropdown dropDown) {
        setUserData(dropDown);

        BlueData data = BlueProjectManager.getInstance().getCurrentProject().getData();
        // FIXME - update once Mixer is updated for JFX ObservableList
        itemsProperty().get().add(Channel.MASTER);
        for (Channel c : data.getMixer().getSubChannels()) {
            itemsProperty().get().add(c.getName());
        }

        getSelectionModel().select(dropDown.getChannelOutput());

        getSelectionModel().selectedItemProperty().addListener((obs, old, newVal) -> {
            dropDown.setChannelOutput(newVal);
        });

        ChangeListener<String> toolTipListener = (obs, old, newVal) -> {
            var comment = dropDown.getComment();
            if (comment == null || comment.isBlank()) {
                setTooltip(null);
            } else {
                setTooltip(tooltip);
            }
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                dropDown.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                setTooltip(null);
            } else {
                dropDown.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(dropDown.commentProperty());
                toolTipListener.changed(null, null, null);
            }
        });
    }
}
