/*
  * blue - object composition environment for csound
  *  Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
  * 
  *  This program is free software; you can redistribute it and/or modify
  *  it under the terms of the GNU General Public License as published
  *  by  the Free Software Foundation; either version 2 of the License or
  *  (at your option) any later version.
  * 
  *  This program is distributed in the hope that it will be useful, but
  *  WITHOUT ANY WARRANTY; without even the implied warranty of
  *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  *  GNU General Public License for more details.
  * 
  *  You should have received a copy of the GNU General Public License
  *  along with this program; see the file COPYING.LIB.  If not, write to
  *  the Free Software Foundation Inc., 59 Temple Place - Suite 330,
  *  Boston, MA  02111-1307 USA
 */

package blue.ui.core.score.layers.soundObject;

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import java.util.Vector;

/**
 *
 * @author steven
 */
public class SoundObjectSelectionBus implements SelectionListener {
    Vector<SelectionListener> listeners = new Vector<SelectionListener>();

    private static SoundObjectSelectionBus instance = null;

    public static SoundObjectSelectionBus getInstance() {
        if(instance == null) {
            instance = new SoundObjectSelectionBus();
        }
        return instance;
    }
    private SelectionEvent lastSelectionEvent;

    private SoundObjectSelectionBus() {}

    public void addSelectionListener(SelectionListener sl) {
        listeners.add(sl);
    }

    public void removeSelectionListener(SelectionListener sl) {
        listeners.remove(sl);
    }

    public void selectionPerformed(SelectionEvent e) {

        lastSelectionEvent = e;

        for(SelectionListener listener : listeners) {
            listener.selectionPerformed(e);
        }
    }

    public SelectionEvent getLastSelectionEvent() {
        return lastSelectionEvent;
    }
}
