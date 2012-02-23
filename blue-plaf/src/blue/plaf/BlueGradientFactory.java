/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.Color;
import java.awt.GradientPaint;
import java.util.HashMap;

/**
 *
 * @author stevenyi
 */
public class BlueGradientFactory {
     private static HashMap<Color, GradientPaint> gpCache = new HashMap<Color, GradientPaint>();

    public static GradientPaint getGradientPaint(Color c) {
        GradientPaint gp = gpCache.get(c);
        if (gp == null) {
            gp = new GradientPaint(0, 0, c.brighter(),
                    0, 6, c);
            gpCache.put(c, gp);
        }
        return gp;
    }

}
