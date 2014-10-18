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

import java.util.Iterator;
import java.util.Vector;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;

import javax.sound.midi.MidiDevice;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.MidiUnavailableException;
import javax.sound.midi.Receiver;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 * Manages MIDI Input Device, single device at a time, notifies listeners when
 * state has changed. Listeners should check if device has changed as well as if
 * device is open.
 * 
 * @author steven
 */
public class MidiInputManager implements Receiver, ChangeListener {

    private static MidiInputManager instance = null;

    private Vector<Receiver> receivers = null;

    private ChangeEvent changeEvent = null;

    private Vector<BlueMidiDevice> items = new Vector<BlueMidiDevice>();

    private boolean running = false;

    /** Creates a new instance of MidiInputManager */
    private MidiInputManager() {
        rescan();
    }

    public static synchronized MidiInputManager getInstance() {
        if (instance == null) {
            instance = new MidiInputManager();
        }
        return instance;
    }

    public void rescan() {
        MidiDevice.Info[] info = MidiSystem.getMidiDeviceInfo();

        Vector<BlueMidiDevice> newItems = new Vector<BlueMidiDevice>();

        for (int i = 0; i < info.length; i++) {
            try {
                if (MidiSystem.getMidiDevice(info[i]).getMaxTransmitters() != 0) {

                    final BlueMidiDevice blueMidiDevice = new BlueMidiDevice(
                                info[i]);
                    BlueMidiDevice old = getDeviceByInfo(blueMidiDevice);

                    if (old == null) {
                        blueMidiDevice.setChangeListener(this);
                        newItems.add(blueMidiDevice);
                    } else {
                        newItems.add(old);
                    }
                }
            } catch (MidiUnavailableException ex) {
                ex.printStackTrace();
            }
        }

        this.items = newItems;

        load();
    }

    private BlueMidiDevice getDeviceByInfo(BlueMidiDevice info) {
        for (BlueMidiDevice device : items) {
            if (device.equals(info)) {
                return device;
            }
        }
        return null;
    }

    public Vector<BlueMidiDevice> getInputDeviceOptions() {
        return items;
    }

    /* ENGINE METHODS */
    public synchronized void start() {
        if (running) {
            return;
        }
        for (BlueMidiDevice device : items) {
            if (device.isEnabled()) {
                try {
                    device.open();
                } catch (MidiUnavailableException ex) {
                    Exceptions.printStackTrace(ex);
                }
            } else {
                device.close();
            }
        }
        running = true;
    }

    public synchronized void stop() {
        if (!running) {
            return;
        }
        for (BlueMidiDevice device : items) {
            device.close();
        }
        running = false;
    }

    public synchronized boolean isRunning() {
        return running;
    }

    /* BROADCAST MIDI TO RECEIVERS */
    public void addReceiver(Receiver receiver) {
        if (receivers == null) {
            receivers = new Vector<Receiver>();
        }
        receivers.add(receiver);
    }

    public void removeReceiver(Receiver receiver) {
        if (receivers != null) {
            receivers.remove(receiver);
        }
    }

    private void broadcastMessage(MidiMessage message, long timeStamp) {
        if (receivers != null) {
            Iterator<Receiver> iter = new Vector<Receiver>(receivers).iterator();

            while (iter.hasNext()) {
                Receiver receiver = iter.next();
                receiver.send(message, timeStamp);
            }
        }
    }

    /* CHANGE LISTENER CODE */
    public void stateChanged(ChangeEvent e) {
        BlueMidiDevice device = (BlueMidiDevice) e.getSource();

        if (device.isOpen()) {
            try {
                device.getMidiDevice().getTransmitter().setReceiver(this);
            } catch (MidiUnavailableException ex) {
                Exceptions.printStackTrace(ex);
            }
        }
    }

    /* RECEIVER METHODS */
    public void send(MidiMessage message, long timeStamp) {
        broadcastMessage(message, timeStamp);
        //System.out.println(timeStamp + " : " + message);
    }

    public void close() {
    }

    /* SAVE/LOAD METHODS */
    protected void save() {
        final Preferences prefs = NbPreferences.forModule(
                MidiInputManager.class);

        for (BlueMidiDevice device : items) {
            prefs.putBoolean(device.getSaveName(), device.isEnabled());
        }

        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    private void load() {
        final Preferences prefs = NbPreferences.forModule(
                MidiInputManager.class);

        for (BlueMidiDevice device : items) {
            device.setEnabled(prefs.getBoolean(device.getSaveName(), false));

            if (running) {
                if (device.isEnabled()) {
                    try {
                        device.open();
                    } catch (MidiUnavailableException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                } else {
                    device.close();
                }
            }
        }
    }
}
