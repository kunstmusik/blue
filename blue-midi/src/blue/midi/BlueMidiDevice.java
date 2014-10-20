/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

import javax.sound.midi.MidiDevice;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.MidiUnavailableException;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

public class BlueMidiDevice {

    private MidiDevice.Info info = null;

    private MidiDevice input = null;

    private ChangeListener cl = null;

    private ChangeEvent e;

    private boolean enabled = false;

    public BlueMidiDevice(MidiDevice.Info info) {
        this.info = info;
        e = new ChangeEvent(this);
    }

    public MidiDevice.Info getDeviceInfo() {
        return info;
    }

    protected void setMidiDevice(MidiDevice input) {
        this.input = input;
    }

    protected MidiDevice getMidiDevice() {
        return this.input;
    }

    public void open() throws MidiUnavailableException {

        if (input != null && input.isOpen()) {
            return;
        }

        try {
            input = MidiSystem.getMidiDevice(info);
            input.open();
            cl.stateChanged(e);
        } catch (MidiUnavailableException ex) {
            input = null;
            throw ex;
        } catch (IllegalArgumentException ex) {
            input = null;
        }
    }

    public boolean isOpen() {
        return input != null && input.isOpen();
    }

    public void close() {
        if (input != null) {
            input.close();
        }
        input = null;

        if (cl != null) {
            cl.stateChanged(e);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String toString() {
        if (info != null) {
            return info.getName();
        }
        return "Error";
    }

    public void setChangeListener(ChangeListener cl) {
        this.cl = cl;
    }

    public final boolean equals(Object obj) {
        if (obj instanceof BlueMidiDevice) {
            BlueMidiDevice dev2 = (BlueMidiDevice) obj;
            MidiDevice.Info info2 = dev2.info;

            return (info.getDescription().equals(info2.getDescription())
                    && info.getName().equals(info2.getName())
                    && info.getVendor().equals(info2.getVendor())
                    && info.getVersion().equals(info2.getVersion()));
        }
        return false;
    }

    public String getSaveName() {
        return info.getDescription() + info.getName() + info.getVendor() + info.
                getVersion();
    }
}
