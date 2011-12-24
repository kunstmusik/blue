/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.Window;
import java.lang.reflect.Method;

/**
 *
 * @author stevenyi
 */
public class MacFullScreenUtil {

    public static void setWindowCanFullScreen(Window window) {
        try {
            Class<?> fullScreenUtil = Class.forName("com.apple.eawt.FullScreenUtilities");
            Method m = fullScreenUtil.getDeclaredMethod("setWindowCanFullScreen", Window.class, Boolean.TYPE);
            m.invoke(null, window, true);
        } catch (Exception e) {
        }
    }
}
