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

package blue.ui.utilities;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Vector;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/** Utility class to handle selections and notification of changes */
public class SelectionModel {
    int anchor = -1;

    int end = -1;

    int lastIndexSet = -1;

    List<ChangeListener> listeners = null;

    ChangeEvent ce = null;

    public void setAnchor(int index) {
        end = anchor = index;

        lastIndexSet = index;

        fireChangeEvent();
    }

    public void setEnd(int index) {
        if (anchor < 0) {
            anchor = index;
        }
        end = index;

        lastIndexSet = index;

        fireChangeEvent();
    }
    
    public void clear() {
        end = anchor = lastIndexSet = -1;
        fireChangeEvent();
    }

    public int getStartIndex() {
        if (anchor < 0) {
            return -1;
        }
        return anchor < end ? anchor : end;
    }

    public int getEndIndex() {
        if (end < 0) {
            return getStartIndex();
        }
        return anchor > end ? anchor : end;
    }

    public int getLastIndexSet() {
        return lastIndexSet;
    }

    public void addChangeListener(ChangeListener cl) {
        if (listeners == null) {
            listeners = new ArrayList<>();
        }
        listeners.add(cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        if (listeners != null) {
            listeners.remove(cl);
        }
    }

    public void fireChangeEvent() {
        if (listeners == null || listeners.size() == 0) {
            return;
        }

        if (ce == null) {
            ce = new ChangeEvent(this);
        }

        for(ChangeListener cl : listeners) {
            cl.stateChanged(ce);
        }
    }
}