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

import java.util.ArrayList;

/**
 * @author steven
 */
public class SelectionList<T> extends ArrayList<T> implements SelectionListener<T> {

    @Override
    public void selectionPerformed(SelectionEvent<T> e) {
        switch (e.selectionType()) {
            case SelectionEvent.SELECTION_CLEAR -> this.clear();
            case SelectionEvent.SELECTION_SINGLE -> {
                T selectedItem = e.selectedItem();
                if (!this.contains(selectedItem)) {
                    this.clear();
                    this.add(selectedItem);
                }
            }
            case SelectionEvent.SELECTION_ADD -> this.add(e.selectedItem());
            case SelectionEvent.SELECTION_REMOVE -> this.remove(e.selectedItem());
        }

    }
}
