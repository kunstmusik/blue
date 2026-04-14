/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.event;

/**
 * Selection event record that holds selection information.
 * 
 * @param selectedItem the item that was selected
 * @param selectionType the type of selection (SELECTION_CLEAR, SELECTION_SINGLE, etc.)
 * @param selectionSubType optional sub-type for the selection
 * @author steven
 */
public record SelectionEvent<T>(T selectedItem, int selectionType, Object selectionSubType) {
    
    public static final int SELECTION_CLEAR = -1;
    public static final int SELECTION_SINGLE = 0;
    public static final int SELECTION_ADD = 1;
    public static final int SELECTION_REMOVE = 2;

    public static final Object SELECTION_LIBRARY = new Object();
    public static final Object SELECTION_BLUE_LIVE = new Object();

    /**
     * Convenience constructor for selections without a sub-type.
     */
    public SelectionEvent(T selectedItem, int selectionType) {
        this(selectedItem, selectionType, null);
    }
}
