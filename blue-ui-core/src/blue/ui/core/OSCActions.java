/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
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
