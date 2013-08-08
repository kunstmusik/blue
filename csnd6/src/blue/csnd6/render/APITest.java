/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.csnd6.render;

import csnd6.Csound;
import csnd6.csnd6;

/**
 *
 * @author syi
 */
public class APITest implements APIInterface {

    public boolean isCsoundAPIAvailable() {
        try {
            csnd6.csoundInitialize(csnd6.CSOUNDINIT_NO_SIGNAL_HANDLER);
            Csound csound = new Csound();
            return true;
        } catch (Throwable e) {
            
        }
        return false;
    }

}
