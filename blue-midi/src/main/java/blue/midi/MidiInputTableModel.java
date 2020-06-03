/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2010 Steven Yi (stevenyi@gmail.com)
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
package blue.midi;

import java.util.Vector;
import javax.sound.midi.MidiUnavailableException;
import javax.swing.table.AbstractTableModel;
import org.openide.util.Exceptions;

/**
 *
 * @author Steven
 */
public class MidiInputTableModel extends AbstractTableModel {

    private final Vector<BlueMidiDevice> devices;

    public MidiInputTableModel() {
        devices = MidiInputManager.getInstance().getInputDeviceOptions();
    }

    @Override
    public int getColumnCount() {
        return 3;
    }

    @Override
    public String getColumnName(int column) {
        switch (column) {
            case 0:
                return "Enabled";
            case 1:
                return "Device Name";
            case 2:
                return "Description";
        }
        return "";
    }

    @Override
    public int getRowCount() {
        return devices.size();
    }

    @Override
    public Object getValueAt(int row, int column) {
        BlueMidiDevice device = devices.get(row);

        switch (column) {
            case 0:
                return device.isEnabled();
            case 1:
                return device.toString();
            case 2:
                return device.getDeviceInfo().getDescription();
        }
        return null;
    }

    @Override
    public boolean isCellEditable(int row, int column) {
        return (column == 0);
    }

    @Override
    public void setValueAt(Object aValue, int row, int column) {
        if (column == 0) {
            BlueMidiDevice device = devices.get(row);
            boolean enabled = ((Boolean) aValue).booleanValue();

            device.setEnabled(enabled);

            if (MidiInputManager.getInstance().isRunning()) {
                if (enabled) {
                    try {
                        device.open();
                    } catch (MidiUnavailableException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                } else {
                    device.close();
                }
            }
            MidiInputManager.getInstance().save();
            fireTableCellUpdated(row, column);
        }
    }

    @Override
    public Class<?> getColumnClass(int columnIndex) {
        return (columnIndex == 0) ? Boolean.class : String.class;
    }
}
