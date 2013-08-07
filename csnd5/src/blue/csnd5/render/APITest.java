/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.csnd5.render;

import csnd.Csound;
import csnd.csnd;

/**
 *
 * @author syi
 */
public class APITest implements APIInterface {

    public boolean isCsoundAPIAvailable() {
        try {
            csnd.csoundInitialize(null, null, csnd.CSOUNDINIT_NO_SIGNAL_HANDLER);
            Csound csound = new Csound();
            return true;
        } catch (Throwable e) {
            
        }
        return false;
    }

}
