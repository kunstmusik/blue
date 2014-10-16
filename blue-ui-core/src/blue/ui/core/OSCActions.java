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
package blue.ui.core;

import blue.MainToolBar;
import blue.osc.OSCAction;
import blue.osc.OSCManager;
import de.sciss.net.OSCMessage;

/**
 *
 * @author stevenyi
 */
public class OSCActions {

    private OSCActions() {
    }

    public static void installActions(OSCManager manager) {

        /* SCORE ACTIONS */

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/play") {

            @Override
            public void actionPerformed(OSCMessage message) {
                MainToolBar mainToolBar = MainToolBar.getInstance();

                if (!mainToolBar.isRendering()) {
                    mainToolBar.renderProject();
                }
            }
        });


        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/stop") {

            @Override
            public void actionPerformed(OSCMessage message) {
                MainToolBar mainToolBar = MainToolBar.getInstance();

                if (mainToolBar.isRendering()) {
                    mainToolBar.stopRendering();
                }
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/rewind") {

            @Override
            public void actionPerformed(OSCMessage message) {
               MainToolBar mainToolBar = MainToolBar.getInstance();

               mainToolBar.rewind();
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/markerNext") {

            @Override
            public void actionPerformed(OSCMessage message) {
            }
        });

        OSCManager.getInstance().registerOSCAction(new OSCAction("/score/markerPrevious") {

            @Override
            public void actionPerformed(OSCMessage message) {
            }
        });

        /* BLUE LIVE ACTIONS */

         OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/onOff") {

            @Override
            public void actionPerformed(OSCMessage message) {
            }
            
        });

          OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/recompile") {

            @Override
            public void actionPerformed(OSCMessage message) {
            }
            
        });

           OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/allNotesOff") {

            @Override
            public void actionPerformed(OSCMessage message) {
            }
            
        });

            OSCManager.getInstance().registerOSCAction(new OSCAction("/blueLive/toggleMidiInput") {

            @Override
            public void actionPerformed(OSCMessage message) {
            }
            
        });

    }
}
