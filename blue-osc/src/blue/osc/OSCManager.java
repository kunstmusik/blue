/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2011 Steven Yi (stevenyi@gmail.com)
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
package blue.osc;

import de.sciss.net.OSCListener;
import de.sciss.net.OSCMessage;
import de.sciss.net.OSCServer;
import java.io.IOException;
import java.net.SocketAddress;
import java.util.ArrayList;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.prefs.PreferenceChangeEvent;
import java.util.prefs.PreferenceChangeListener;
import java.util.prefs.Preferences;
import org.openide.util.NbPreferences;

/**
 *
 * @author stevenyi
 */
public class OSCManager implements OSCListener {
    
    private static OSCManager instance = null;

    private ArrayList<OSCAction> oscActions = new ArrayList<OSCAction>();
   
    private OSCServer server = null;
    
    final Preferences prefs = NbPreferences.forModule(
                    OSCManager.class);
    
    private OSCManager() {
        prefs.addPreferenceChangeListener(new PreferenceChangeListener() {

            @Override
            public void preferenceChange(PreferenceChangeEvent evt) {
                if(server != null) {
                    stop();
                    start();
                } 
            }
        });
    }    

    public static OSCManager getInstance() {
        if(instance == null) {
            instance = new OSCManager();
        }
        return instance;
    }

    public void start() {
        int inputPort = prefs.getInt("serverPort", 8000);

        try {
            server = OSCServer.newUsing(OSCServer.UDP, inputPort, false);
            server.addOSCListener(this);
            server.start();
        } catch (IOException ex) {
            Logger.getLogger(OSCManager.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    public void stop() {
        if(server != null) {
            try {
                server.stop();
                
            } catch (IOException ex) {
                Logger.getLogger(OSCManager.class.getName()).log(Level.SEVERE, null, ex);
            }
            server.dispose();
            server = null;
        }
    }

    public void registerOSCAction(OSCAction action) {
        oscActions.add(action);
    }
    
    public void deregisterOSCAction(OSCAction action) {
        oscActions.remove(action);        
    }

    /* OSC LISTENER */
    
    @Override
    public void messageReceived(OSCMessage oscm, SocketAddress sa, long l) {
        String port = oscm.getName();

        for(OSCAction action : oscActions) {
            if(port.startsWith(action.getOscPath())) {
                action.actionPerformed(oscm);
                break;
            }
        }
    }
}
