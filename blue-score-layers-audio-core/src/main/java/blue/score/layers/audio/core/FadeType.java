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
package blue.score.layers.audio.core;

/**
 * Fade types, based on types used in Ardour
 * 
 * @author stevenyi
 */
public enum FadeType {
 
   LINEAR("Linear"), 
   CONSTANT_POWER("Constant Power"), 
   SYMMETRIC("Symmetric"), 
   FAST("Fast"), 
   SLOW("Slow");

   private final String value;
   
   private FadeType(String value) {
       this.value = value;
   }

   @Override
   public String toString() {
       return value;
   }

   public static FadeType fromString(String type) {
        switch (type) {
            case "Linear":
                return LINEAR;
            case "Constant Power":
                return CONSTANT_POWER;
            case "Symmetric":
                return SYMMETRIC;
            case "Fast":
                return FAST;
            case "Slow":
                return SLOW;
        }
        return null;
    }
}
