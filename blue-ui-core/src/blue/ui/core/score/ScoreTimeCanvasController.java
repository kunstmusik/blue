/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.score;

import javax.swing.JOptionPane;

import blue.BlueSystem;
import blue.soundObject.SoundObject;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */

// TODO - This class was not a good design, need to refactor out
public class ScoreTimeCanvasController {

    private ScoreTimeCanvas sTimeCanvas;

    public ScoreTimeCanvasController(ScoreTimeCanvas sTimeCanvas) {
        this.sTimeCanvas = sTimeCanvas;
    }

    public void shiftSoundObjects() {
        if (sTimeCanvas.mBuffer.size() <= 0) {
            return;
        }

        String value = JOptionPane.showInputDialog(null, BlueSystem
                .getString("scoreGUI.action.shift.message"));

        sTimeCanvas.mBuffer.motionBufferObjects();
        SoundObjectView[] views = sTimeCanvas.mBuffer.motionBuffer;

        try {
            float val = Float.parseFloat(value);

            for (int i = 0; i < views.length; i++) {
                if ((views[i].getStartTime() + val) < 0) {
                    JOptionPane.showMessageDialog(null, BlueSystem
                            .getString("scoreGUI.action.shift.error"));
                    return;
                }
            }

            for (int i = 0; i < views.length; i++) {
                SoundObject sObj = views[i].getSoundObject();

                views[i].setStartTime(sObj.getStartTime() + val);
            }

        } catch (NumberFormatException nfe) {
            System.err.println(nfe.getMessage());
        }
    }
}