/*
 * blue - object composition environment for csound
 * Copyright (c) 2026 Steven Yi (stevenyi@gmail.com)
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

import blue.score.SnapValue;
import blue.soundObject.PianoRoll;
import blue.ui.core.score.SnapConfigPopup;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JToggleButton;
import javax.swing.SwingUtilities;

/**
 * Toggle button for PianoRoll snap on/off with right-click popup for snap
 * value configuration. Mirrors the Score's SnapButton pattern but targets
 * PianoRoll fields directly.
 *
 * @author Steven Yi
 */
public class PianoRollSnapButton extends JToggleButton implements PropertyChangeListener {

    private PianoRoll pianoRoll;
    private final SnapConfigPopup popup;
    private boolean isUpdating = false;

    public PianoRollSnapButton() {
        super("Snap");
        setToolTipText("Toggle snap (left-click) | Configure snap (right-click)");
        setFocusable(false);

        popup = new SnapConfigPopup(this::onSnapValueSelected);

        addActionListener(e -> {
            if (!isUpdating && pianoRoll != null) {
                pianoRoll.setSnapEnabled(isSelected());
            }
        });

        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (SwingUtilities.isRightMouseButton(e)) {
                    popup.show(PianoRollSnapButton.this, e.getX(), e.getY());
                }
            }
        });

        updateButtonText();
    }

    private void onSnapValueSelected(SnapValue snapValue) {
        if (pianoRoll != null) {
            pianoRoll.setSnapValueEnum(snapValue);
            updateButtonText();
        }
    }

    private void updateButtonText() {
        SnapValue sv = pianoRoll != null ? pianoRoll.getSnapValueEnum() : SnapValue.BEAT;
        setText("Snap: " + sv.getDisplayName());
    }

    public void setPianoRoll(PianoRoll pianoRoll) {
        if (this.pianoRoll != null) {
            this.pianoRoll.removePropertyChangeListener(this);
        }

        this.pianoRoll = pianoRoll;

        if (pianoRoll != null) {
            pianoRoll.addPropertyChangeListener(this);
            syncFromPianoRoll();
        }
    }

    private void syncFromPianoRoll() {
        if (pianoRoll == null) return;

        isUpdating = true;
        try {
            setSelected(pianoRoll.isSnapEnabled());
            updateButtonText();
        } finally {
            isUpdating = false;
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (isUpdating || evt.getSource() != pianoRoll) return;

        switch (evt.getPropertyName()) {
            case "snapEnabled" -> {
                isUpdating = true;
                try {
                    setSelected((boolean) evt.getNewValue());
                } finally {
                    isUpdating = false;
                }
            }
            case "snapValueEnum" -> updateButtonText();
        }
    }
}
