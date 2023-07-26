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
package blue.orchestra.editor.blueSynthBuilder.swing;

/**
 *
 * @author stevenyi
 */
public enum Alignment {
    LEFT("Left"), HORIZONTAL_CENTER("Horizontal Center"), RIGHT("Right"), 
    TOP("Top"), VERTICAL_CENTER("Vertical Center"), BOTTOM("Bottom"); 

    private final String string;

    Alignment(String name) {
        string = name;
    }

    @Override
    public String toString() {
        return string; 
    }

        
}
