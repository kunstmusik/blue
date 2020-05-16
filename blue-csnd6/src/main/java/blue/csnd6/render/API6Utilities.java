/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.csnd6.render;

import com.kunstmusik.csoundjni.CsoundJNI;

/**
 *
 * @author syi
 */
public class API6Utilities {

    private static boolean hasBeenInitialized = false;
    private static boolean apiAvailable = false;

    public static boolean isCsoundAPIAvailable() {
        if (!hasBeenInitialized) {

            String val = System.getProperty("DISABLE_CSOUND6");

            if ("true".equals(val)) {
                apiAvailable = false;
            } else {
                try {
                    CsoundJNI.csoundInitialize(CsoundJNI.CSOUNDINIT_NO_ATEXIT | 
                            CsoundJNI.CSOUNDINIT_NO_SIGNAL_HANDLER);
//                    System.loadLibrary("_jcsound6");
//                     csnd6.csoundInitialize(csnd6.CSOUNDINIT_NO_ATEXIT | 
//                csnd6.CSOUNDINIT_NO_SIGNAL_HANDLER);
                    apiAvailable = true;
                } catch (Throwable e) {
                    apiAvailable = false;
                }
            }

            hasBeenInitialized = true;
        }
        return apiAvailable;
    }
}
