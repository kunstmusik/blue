/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.utility;

import csnd.Csound;

/**
 *
 * @author syi
 */
public class APITest implements APIInterface {

    public boolean isCsoundAPIAvailable() {
        try {
            csnd.csnd.csoundInitialize(null, null, csnd.csnd.CSOUNDINIT_NO_SIGNAL_HANDLER);
            Csound csound = new Csound();
            return true;
        } catch (Throwable e) {
            
        }
        return false;
    }

}
