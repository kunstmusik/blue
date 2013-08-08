/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.csnd6.render;

/**
 *
 * @author syi
 */
public class APIUtilities {
    private static boolean hasBeenInitialized = false;
    private static boolean apiAvailable = false;
    
    public static boolean isCsoundAPIAvailable() {
        if(!hasBeenInitialized) {
            try {
                Class c = Class.forName("blue.csnd6.render.APITest", true, Thread.currentThread().getContextClassLoader());
                APIInterface apiInterface = (APIInterface) c.newInstance();
                
                apiAvailable = apiInterface.isCsoundAPIAvailable();
            } catch (Throwable e) {
                apiAvailable = false;
            }
            hasBeenInitialized = true;
        }
        
        return apiAvailable;
    }
}
