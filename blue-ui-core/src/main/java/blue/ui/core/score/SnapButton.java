/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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

import blue.score.SnapValue;
import blue.score.TimeState;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JToggleButton;
import javax.swing.SwingUtilities;

/**
 * Toggle button for snap on/off with right-click popup for snap configuration.
 * Left-click toggles snap enabled state.
 * Right-click opens snap configuration popup.
 *
 * @author Steven Yi
 */
public class SnapButton extends JToggleButton implements PropertyChangeListener {

    private TimeState timeState;
    private SnapConfigPopup popup;
    private boolean isUpdating = false;
    private SnapValue currentSnapValue = SnapValue.BEAT;

    public SnapButton() {
        super("Snap");
        setToolTipText("Toggle snap (left-click) | Configure snap (right-click)");
        
        popup = new SnapConfigPopup(this::onSnapValueSelected);
        
        addActionListener(e -> {
            if (!isUpdating && timeState != null) {
                timeState.setSnapEnabled(isSelected());
            }
        });
        
        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (SwingUtilities.isRightMouseButton(e)) {
                    popup.show(SnapButton.this, e.getX(), e.getY());
                }
            }
        });
        
        updateButtonText();
    }
    
    private void onSnapValueSelected(SnapValue snapValue) {
        if (timeState != null) {
            timeState.setSnapValue(snapValue);
        }
    }
    
    private void updateButtonText() {
        String text = "Snap";
        if (currentSnapValue != null) {
            text = "Snap: " + currentSnapValue.getDisplayName();
        }
        setText(text);
    }

    public void setTimeState(TimeState timeState) {
        if (this.timeState != null) {
            this.timeState.removePropertyChangeListener(this);
        }
        
        this.timeState = timeState;
        
        if (timeState != null) {
            timeState.addPropertyChangeListener(this);
            syncFromTimeState();
        }
    }
    
    private void syncFromTimeState() {
        if (timeState == null) return;
        
        isUpdating = true;
        try {
            setSelected(timeState.isSnapEnabled());
            currentSnapValue = timeState.getSnapValue();
            updateButtonText();
        } finally {
            isUpdating = false;
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (isUpdating) return;
        
        switch (evt.getPropertyName()) {
            case "snapEnabled" -> {
                isUpdating = true;
                try {
                    setSelected((boolean) evt.getNewValue());
                } finally {
                    isUpdating = false;
                }
            }
            case "snapValue" -> {
                currentSnapValue = (SnapValue) evt.getNewValue();
                updateButtonText();
            }
        }
    }
    
    public SnapValue getCurrentSnapValue() {
        return currentSnapValue;
    }
}
