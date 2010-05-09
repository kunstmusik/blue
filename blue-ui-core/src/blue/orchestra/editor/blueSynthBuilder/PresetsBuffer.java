/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

package blue.orchestra.editor.blueSynthBuilder;

import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;

/**
 * 
 * @author steven
 */
public class PresetsBuffer {

    private static PresetsBuffer instance = null;

    PresetGroup group = null;

    Preset preset = null;

    /** Creates a new instance of PresetsBuffer */
    private PresetsBuffer() {
    }

    public static PresetsBuffer getInstance() {
        if (instance == null) {
            instance = new PresetsBuffer();
        }
        return instance;
    }

    public boolean hasItem() {
        return (group != null || preset != null);
    }

    public void setBufferedItem(Preset preset) {
        this.preset = preset;
        this.group = null;
    }

    public void setBufferedItem(PresetGroup group) {
        this.preset = null;
        this.group = group;
    }

    public Object getBufferedItem() {
        if (group != null) {
            return group;
        }
        return preset;
    }
}
