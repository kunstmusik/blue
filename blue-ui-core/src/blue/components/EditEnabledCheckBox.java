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

package blue.components;

import blue.BlueSystem;
import blue.event.EditModeListener;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.EventListener;
import javax.swing.JCheckBox;
import javax.swing.SwingConstants;

/**
 * @author Steven Yi
 */
public class EditEnabledCheckBox extends JCheckBox implements ActionListener {

    public EditEnabledCheckBox() {
        this(false);
    }

    public EditEnabledCheckBox(boolean initialState) {
        this.setSelected(initialState);
        this.setText(BlueSystem.getString("editEnabledCheckBox.text") + ": ");
        this.setHorizontalTextPosition(SwingConstants.LEFT);

        setFocusable(false);

        this.addActionListener(this);
    }

    public void addEditModeListener(EditModeListener listener) {
        this.listenerList.add(EditModeListener.class, listener);
    }

    public void fireEditModeChanged(boolean val) {
        EventListener[] listeners = listenerList
                .getListeners(EditModeListener.class);

        for (int i = 0; i < listeners.length; i++) {
            EditModeListener listener = (EditModeListener) listeners[i];
            listener.setEditing(val);
        }

    }

    @Override
    public void actionPerformed(ActionEvent e) {
        fireEditModeChanged(this.isSelected());
    }
}