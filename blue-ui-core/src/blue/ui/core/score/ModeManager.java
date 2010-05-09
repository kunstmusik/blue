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
package blue.ui.core.score;

import java.util.Iterator;
import java.util.Vector;

public class ModeManager {
    public static final int MODE_SCORE = 0;

    public static final int MODE_SINGLE_LINE = 1;

    public static final int MODE_MULTI_LINE = 2;

    private static ModeManager instance = null;

    private int mode = MODE_SCORE;

    private Vector listeners = null;

    private ModeManager() {
    }

    public static ModeManager getInstance() {
        if (instance == null) {
            instance = new ModeManager();
        }
        return instance;
    }

    public int getMode() {
        return mode;
    }

    public void setMode(int mode) {
        this.mode = mode;
        fireModeChanged(mode);
    }

    public void nextMode() {
        if (mode < MODE_MULTI_LINE) {
            mode++;
        } else {
            mode = MODE_SCORE;
        }
        fireModeChanged(mode);
    }

    public void previousMode() {
        if (mode > MODE_SCORE) {
            mode--;
        } else {
            mode = MODE_MULTI_LINE;
        }

        fireModeChanged(mode);
    }

    /* Listener Code */
    public void addModeListener(ModeListener listener) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(listener);
    }

    public void removeModeListener(ModeListener listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    public void fireModeChanged(int mode) {
        if (listeners != null) {
            Iterator iter = new Vector(listeners).iterator();

            while (iter.hasNext()) {
                ModeListener listener = (ModeListener) iter.next();
                listener.modeChanged(mode);
            }
        }
    }
}
