/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.csnd5.render;

/**
 *
 * @author syi
 */
public class APIUtilities {

    private static boolean hasBeenInitialized = false;
    private static boolean apiAvailable = false;

    public static boolean isCsoundAPIAvailable() {
        if (!hasBeenInitialized) {

            if ("true".equals(System.getProperty("CSND6_LOADED"))) {
                apiAvailable = false;
            } else {

                try {
                    System.loadLibrary("_jcsound");
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
