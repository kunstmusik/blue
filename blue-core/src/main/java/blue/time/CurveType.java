/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.time;

/**
 * Defines how tempo transitions between two tempo points.
 * 
 * @author stevenyi
 */
public enum CurveType {
    
    /**
     * Constant tempo until the next point, then instant jump.
     * The tempo stays at the current point's value until reaching
     * the next point, where it immediately changes to the new tempo.
     */
    CONSTANT,
    
    /**
     * Linear interpolation between tempo points.
     * The tempo gradually and evenly changes from one point to the next,
     * creating accelerando or ritardando effects.
     */
    LINEAR;
    
    /**
     * Returns the default curve type for new tempo points.
     */
    public static CurveType getDefault() {
        return LINEAR;
    }
    
    /**
     * Parses a curve type from a string, returning the default if not recognized.
     */
    public static CurveType fromString(String value) {
        if (value == null || value.isEmpty()) {
            return getDefault();
        }
        try {
            return valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return getDefault();
        }
    }
}
