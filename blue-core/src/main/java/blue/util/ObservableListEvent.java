/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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

package blue.util;

import java.util.List;

/**
 *
 * @author stevenyi
 */
public class ObservableListEvent<E> {
    public static final int DATA_ADDED = 0;
    public static final int DATA_REMOVED = 1;
    public static final int DATA_CHANGED = 2;
    public static final int DATA_SET = 4;
    public static final int DATA_PUSHED_UP = 8;
    public static final int DATA_PUSHED_DOWN = 16;
    private final int startIndex;
    private final int endIndex;
    private final int type;
    private final int subType;
    private final List<E> source;
    private final List<E> affectedItems;

    public ObservableListEvent(List<E> source, int type, int subType, int startIndex, int endIndex, List<E> affectedItems) {
        this.source = source;
        this.type = type;
        this.subType = subType;
        this.startIndex = Math.min(startIndex, endIndex);
        this.endIndex = Math.max(startIndex, endIndex);
        this.affectedItems = affectedItems;
    }

    public int getStartIndex() {
        return startIndex;
    }

    public int getEndIndex() {
        return endIndex;
    }

    public int getType() {
        return type;
    }

    public int getSubType() {
        return subType;
    }

    public List<E> getSource() {
        return source;
    }

    public List<E> getAffectedItems() {
        return affectedItems;
    }
    
}
