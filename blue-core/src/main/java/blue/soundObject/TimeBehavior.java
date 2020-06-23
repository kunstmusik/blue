/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 
 * Steven Yi (stevenyi@gmail.com)
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

/**
 *
 * @author syyigmmbp
 */
public enum TimeBehavior {
    /**
     * SoundObject does not support applying time behaviors and is assumed to
     * generate score for duration of subjectiveDuration
     */
    NOT_SUPPORTED(-1),
    SCALE(0),
    REPEAT_CLASSIC(1),
    NONE(2),
    REPEAT(3)
    ;
    
    private int type;

    private TimeBehavior(int type) {
        this.type = type;
    }
    
    public int getType() {
        return type;
    }
    
    public static TimeBehavior valueByType(int type) {
        for(var t : values()) {
            if(t.getType() == type) {
                return t;
            }
        }
        return null;
    }
}
