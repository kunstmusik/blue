/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject;

public class SoundObjectEvent {

    public static final int NAME = 0;

    public static final int START_TIME = 1;

    public static final int DURATION = 2;

    public static final int COLOR = 3;

    public static final int REPEAT_POINT = 4;

    private SoundObject sObj;

    private int propertyChanged;

    public SoundObjectEvent(SoundObject sObj, int propertyChanged) {
        this.sObj = sObj;
        this.propertyChanged = propertyChanged;
    }

    public int getPropertyChanged() {
        return propertyChanged;
    }

    public SoundObject getSoundObject() {
        return sObj;
    }

}
