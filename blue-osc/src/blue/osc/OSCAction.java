/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.osc;

import de.sciss.net.OSCMessage;

/**
 *
 * @author stevenyi
 */
public abstract class OSCAction {

    private final String oscPath;

    public OSCAction(String oscPath) {
        this.oscPath = oscPath;
    }

    /**
     * @return the oscPath
     */
    public String getOscPath() {
        return oscPath;
    }

    public abstract void actionPerformed(OSCMessage message);

}
