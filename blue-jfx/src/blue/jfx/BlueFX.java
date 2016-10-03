/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.jfx;

import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.layout.Region;

/**
 *
 * @author stevenyi
 */
public class BlueFX {

    public static void style(Scene scene) {
        scene.getStylesheets().add(
                BlueFX.class.getResource("bluefx.css").toExternalForm());
    }

    public static void style(Region region) {
        region.getStylesheets().add(
                BlueFX.class.getResource("bluefx.css").toExternalForm());
    }

    public static void runOnFXThread(Runnable r) {
        if(Platform.isFxApplicationThread()) {
           r.run();
        } else {
           Platform.runLater(r);
        }
    }
}
