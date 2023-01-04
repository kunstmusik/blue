/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.ui.utilities;

import java.awt.Color;
import javax.swing.Icon;
import jiconfont.icons.google_material_design_icons.GoogleMaterialDesignIcons;
import jiconfont.swing.IconFontSwing;

/**
 *
 * @author stevenyi
 */
public class BlueCommonIcons {
    public static Icon ADD =  IconFontSwing.buildIcon(GoogleMaterialDesignIcons.ADD, 14, Color.WHITE);

    public static Icon REMOVE = IconFontSwing.buildIcon(GoogleMaterialDesignIcons.DELETE_FOREVER, 14, Color.WHITE);

    public static Icon PUSH_UP = IconFontSwing.buildIcon(GoogleMaterialDesignIcons.ARROW_UPWARD, 14, Color.WHITE);

    public static Icon PUSH_DOWN = IconFontSwing.buildIcon(GoogleMaterialDesignIcons.ARROW_DOWNWARD, 14, Color.WHITE);
}
