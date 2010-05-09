/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import blue.soundObject.PolyObject;

public final class TimePixelManager implements ActionListener {

    private PolyObject pObj;

    public TimePixelManager() {
    }

    public void lowerPixelSecond() {
        if (pObj == null) {
            return;
        }

        int pixelSecond = pObj.getPixelSecond();

        if (pixelSecond <= 2) {
            return;
        }

        pixelSecond -= 2;

        pObj.setPixelSecond(pixelSecond);
    }

    public void raisePixelSecond() {
        if (pObj == null) {
            return;
        }

        int pixelSecond = pObj.getPixelSecond() + 2;
        pObj.setPixelSecond(pixelSecond);
    }

    public void actionPerformed(ActionEvent ae) {
        String command = ae.getActionCommand();

        if (command.equals("minusHorizontal")) {
            lowerPixelSecond();
        } else if (command.equals("plusHorizontal")) {
            raisePixelSecond();
        }
    }

    /**
     * @param obj
     */
    public void setPolyObject(PolyObject pObj) {
        this.pObj = pObj;
    }

}