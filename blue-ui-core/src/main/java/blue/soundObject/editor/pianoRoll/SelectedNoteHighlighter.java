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

package blue.soundObject.editor.pianoRoll;

import java.awt.Color;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import javax.swing.BorderFactory;
import javax.swing.JPanel;

public class SelectedNoteHighlighter extends JPanel {
    PianoNoteView pianoNoteView;

    ComponentListener cl;

    public SelectedNoteHighlighter(PianoNoteView pnv) {
        this.setBackground(Color.GREEN);
        this.setSize(5, pnv.getHeight());
        this.setBorder(BorderFactory.createRaisedBevelBorder());

        this.pianoNoteView = pnv;

        cl = new ComponentAdapter() {

            @Override
            public void componentMoved(ComponentEvent arg0) {
                int newY = pianoNoteView.getY();
                if (newY != getY()) {
                    setLocation(getX(), newY);
                }
            }

        };

        pnv.addComponentListener(cl);

    }

    public void cleanup() {
        pianoNoteView.removeComponentListener(cl);
        pianoNoteView = null;
    }
}
