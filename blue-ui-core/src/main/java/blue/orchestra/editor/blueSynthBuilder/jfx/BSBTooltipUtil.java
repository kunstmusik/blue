/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
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

import javafx.scene.Node;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.Region;
import javafx.util.Duration;

/**
 *
 * @author stevenyi
 */
public class BSBTooltipUtil {

    /**
     * Factory for pre-configured tooltip for BSB
     */
    public static Tooltip createTooltip() {
        Tooltip tooltip = new Tooltip();
        tooltip.setShowDelay(Duration.seconds(0.5));
        tooltip.setWrapText(true);
        tooltip.setMaxWidth(400);
        return tooltip;
    }

    /**
     * Recursively calls Tooltip.install() on Node and all children
     */
    public static void install(Node node, Tooltip tooltip) {
        Tooltip.install(node, tooltip);

        if (node instanceof Region) {
            var region = (Region) node;
            region.getChildrenUnmodifiable().forEach(n -> install(n, tooltip));
        }
    }
}
