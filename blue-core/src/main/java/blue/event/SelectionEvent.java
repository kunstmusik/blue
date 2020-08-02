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
 * @author steven
 */
public class SelectionEvent<T> {
    public static final int SELECTION_CLEAR = -1;

    public static final int SELECTION_SINGLE = 0;

    public static final int SELECTION_ADD = 1;

    public static final int SELECTION_REMOVE = 2;

    public static final Object SELECTION_LIBRARY = new Object();

    public static final Object SELECTION_BLUE_LIVE = new Object();
    
    private final T itemSelected;

    private final int selectionType;
    private Object selectionSubType = null;

    public SelectionEvent(T itemSelected, int selectionType) {
        this(itemSelected, selectionType, null);
    }

    public SelectionEvent(T itemSelected, int selectionType, Object selectionSubType) {
        this.itemSelected = itemSelected;
        this.selectionType = selectionType;
        this.selectionSubType = selectionSubType;
    }

    public T getSelectedItem() {
        return itemSelected;
    }

    public int getSelectionType() {
        return this.selectionType;
    }

    public Object getSelectionSubType() {
        return selectionSubType;
    }
}
